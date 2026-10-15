import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { ulid } from 'ulid';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { AuthService } from '../src/auth/auth.service';

// Solo modifica un usuario sintético creado por esta suite y lo retira al terminar.
const integration = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
integration('Autenticación con MariaDB', () => {
  const db = new PrismaClient();
  const code = `TEST_AUTH_${randomUUID().slice(0, 8)}`;
  const password = randomUUID();
  let id: bigint;
  let app: INestApplication<App>;

  beforeAll(async () => {
    const user = await db.usuarios.create({
      data: {
        codigo_publico: ulid(),
        codigo_acceso: code,
        nombres: 'Prueba automática',
        apellidos: 'Autenticación',
        contrasena_hash: await hash(password, 12),
      },
    });
    id = user.id;
    const role = await db.roles.findUniqueOrThrow({
      where: { codigo: 'USUARIO_NORMAL' },
    });
    await db.usuario_rol.create({ data: { usuario_id: id, rol_id: role.id } });
  });

  beforeEach(async () => {
    await db.usuario_permiso.deleteMany({ where: { usuario_id: id } });
    await db.usuario_rol.deleteMany({ where: { usuario_id: id } });
    const normal = await db.roles.findUniqueOrThrow({
      where: { codigo: 'USUARIO_NORMAL' },
    });
    await db.usuario_rol.create({
      data: { usuario_id: id, rol_id: normal.id },
    });
    await db.usuarios.update({
      where: { id },
      data: {
        estado: 'ACTIVO',
        desactivado_en: null,
        intentos_fallidos: 0,
        bloqueado_hasta: null,
      },
    });
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    if (app) await app.close();
  });
  afterAll(async () => {
    try {
      if (id)
        await db.$transaction(async (tx) => {
          await tx.registros_auditoria.deleteMany({
            where: { usuario_id: id },
          });
          await tx.sesiones_usuario.deleteMany({ where: { usuario_id: id } });
          await tx.usuario_permiso.deleteMany({ where: { usuario_id: id } });
          await tx.usuario_rol.deleteMany({ where: { usuario_id: id } });
          await tx.usuarios.delete({ where: { id } });
        });
    } finally {
      await db.$disconnect();
    }
  });

  function login(pass: string = password) {
    return request(app.getHttpServer())
      .post('/auth/login')
      .set('X-NutriTech-Request', '1')
      .set('Origin', 'http://127.0.0.1:5173')
      .send({ codigo_acceso: code, contrasena: pass });
  }

  it('restablece una cuenta bloqueada, revoca sesiones y admite solo la nueva contraseña', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { resetPassword } = require('../scripts/reset-password.cjs') as {
      resetPassword: (
        db: PrismaClient,
        id: bigint,
        pass: string,
      ) => Promise<void>;
    };
    const oldSession = await login().expect(200);
    const cookie = (
      oldSession.headers['set-cookie'] as unknown as string[]
    )[0].split(';')[0];
    const next = randomUUID();
    try {
      await db.usuarios.update({
        where: { id },
        data: {
          intentos_fallidos: 5,
          bloqueado_hasta: new Date(Date.now() + 900000),
        },
      });
      await resetPassword(db, id, next);
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookie)
        .expect(401);
      await login(password).expect(401);
      const result = await login(next).expect(200);
      await request(app.getHttpServer())
        .get('/auth/me')
        .set(
          'Cookie',
          (result.headers['set-cookie'] as unknown as string[])[0].split(
            ';',
          )[0],
        )
        .expect(200);
      const user = await db.usuarios.findUniqueOrThrow({ where: { id } });
      expect(user.intentos_fallidos).toBe(0);
      expect(user.bloqueado_hasta).toBeNull();
    } finally {
      await db.usuarios.update({
        where: { id },
        data: { contrasena_hash: await hash(password, 12) },
      });
      await db.registros_auditoria.deleteMany({
        where: {
          entidad: 'usuarios',
          entidad_id: String(id),
          usuario_id: null,
        },
      });
    }
  });

  it('protege el perfil sin sesión', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('valida el DTO y rechaza campos adicionales', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-NutriTech-Request', '1')
      .send({ codigo_acceso: code, contrasena: password, rol: 'ADMINISTRADOR' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-NutriTech-Request', '1')
      .send({ codigo_acceso: 123, contrasena: [] })
      .expect(400);
  });

  it('rechaza peticiones de otro origen o sin la cabecera CSRF', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ codigo_acceso: code, contrasena: password })
      .expect(403);
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-NutriTech-Request', '1')
      .set('Origin', 'https://sitio-ajeno.example')
      .send({ codigo_acceso: code, contrasena: password })
      .expect(403);
  });

  it('usa cookie HttpOnly, devuelve solo perfil permitido y revoca al salir', async () => {
    const result = await login().expect(200);
    expect(result.body).toEqual({ mensaje: 'Sesión iniciada.' });
    const cookies = result.headers['set-cookie'] as unknown as string[];
    expect(cookies[0]).toContain('HttpOnly');
    expect(cookies[0]).toContain('SameSite=Strict');
    const cookie = cookies[0].split(';')[0];
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(200);
    expect((me.body as { codigo_acceso: string }).codigo_acceso).toBe(code);
    expect((me.body as { roles: unknown }).roles).toEqual([
      { codigo: 'USUARIO_NORMAL', nombre: 'Usuario normal' },
    ]);
    expect(me.body).not.toHaveProperty('contrasena_hash');
    expect(me.body).not.toHaveProperty('id');
    expect((me.body as { permisos: string[] }).permisos).toContain(
      'evaluaciones.crear',
    );
    expect((me.body as { permisos: string[] }).permisos).not.toContain(
      'roles.gestionar',
    );
    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('X-NutriTech-Request', '1')
      .set('Cookie', cookie)
      .expect(204);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookie)
      .expect(401);
    expect(
      await db.registros_auditoria.count({
        where: { usuario_id: id, accion: 'CERRAR_SESION' },
      }),
    ).toBeGreaterThan(0);
  });

  it('guarda los intentos fallidos y aplica bloqueo temporal', async () => {
    for (let i = 0; i < 5; i++) await login('incorrecta').expect(401);
    const user = await db.usuarios.findUniqueOrThrow({ where: { id } });
    expect(user.intentos_fallidos).toBe(5);
    expect(user.bloqueado_hasta!.getTime()).toBeGreaterThan(Date.now());
    await expect(
      app.get(AuthService).login({ codigo_acceso: code, contrasena: password }),
    ).rejects.toThrow('Código o contraseña incorrectos');
    await db.usuarios.update({
      where: { id },
      data: { bloqueado_hasta: new Date(Date.now() - 1000) },
    });
    await app
      .get(AuthService)
      .login({ codigo_acceso: code, contrasena: password });
    const recovered = await db.usuarios.findUniqueOrThrow({ where: { id } });
    expect(recovered.intentos_fallidos).toBe(0);
    expect(recovered.bloqueado_hasta).toBeNull();
  });

  it.each(['INACTIVO', 'BLOQUEADO'] as const)(
    'rechaza estado %s',
    async (estado) => {
      await db.usuarios.update({ where: { id }, data: { estado } });
      await login().expect(401);
    },
  );

  it('rechaza una sesión existente si el usuario se desactiva', async () => {
    const result = await login().expect(200);
    const cookies = result.headers['set-cookie'] as unknown as string[];
    await db.usuarios.update({ where: { id }, data: { estado: 'INACTIVO' } });
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookies[0].split(';')[0])
      .expect(401);
  });

  it('rechaza token manipulado, vencido o sin sesión registrada', async () => {
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', 'nutritech_session=manipulado')
      .expect(401);
    const jwt = app.get(JwtService);
    for (const exp of [
      Math.floor(Date.now() / 1000) - 10,
      Math.floor(Date.now() / 1000) + 900,
    ]) {
      const token = await jwt.signAsync({
        sub: id.toString(),
        jti: randomUUID(),
        exp,
      });
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', `nutritech_session=${token}`)
        .expect(401);
    }
  });

  it('no trunca contraseñas de más de 72 bytes en bcrypt', async () => {
    await login('á'.repeat(37)).expect(401);
  });

  it('limita a cinco solicitudes de login por minuto e IP', async () => {
    for (let i = 0; i < 5; i++) await login('incorrecta').expect(401);
    await login().expect(429);
  });
  async function cookie() {
    const response = await login().expect(200);
    return (response.headers['set-cookie'] as unknown as string[])[0].split(
      ';',
    )[0];
  }

  it('devuelve solo las tres opciones del usuario normal y rechaza consulta administrativa', async () => {
    const session = await cookie();
    const response = await request(app.getHttpServer())
      .get('/menu?usuario_id=1')
      .set('Cookie', session)
      .expect(200);
    const modules = response.body as { opciones: { codigo: string }[] }[];
    expect(
      modules.flatMap((module) =>
        module.opciones.map((option) => option.codigo),
      ),
    ).toEqual(['EVALUACIONES_CREAR', 'ALERTAS_LISTAR', 'REPORTES_GENERAR']);
    expect(response.headers['cache-control']).toBe('no-store');
    await request(app.getHttpServer())
      .get('/seguridad/roles')
      .set('Cookie', session)
      .expect(403);
  });

  it('permite consultar roles al administrador, sin duplicar opciones por varios roles', async () => {
    const admin = await db.roles.findUniqueOrThrow({
      where: { codigo: 'ADMINISTRADOR' },
    });
    await db.usuario_rol.create({ data: { usuario_id: id, rol_id: admin.id } });
    const session = await cookie();
    const response = await request(app.getHttpServer())
      .get('/menu')
      .set('Cookie', session)
      .expect(200);
    const modules = response.body as { opciones: { codigo: string }[] }[];
    const codes = modules.flatMap((module) =>
      module.opciones.map((option) => option.codigo),
    );
    expect(codes).toHaveLength(13);
    expect(new Set(codes).size).toBe(13);
    const roles = await request(app.getHttpServer())
      .get('/seguridad/roles')
      .set('Cookie', session)
      .expect(200);
    expect(
      (roles.body as { codigo: string }[]).some(
        (role) => role.codigo === 'ADMINISTRADOR',
      ),
    ).toBe(true);
  });

  it('aplica denegación directa al administrador sin esperar a otro inicio de sesión', async () => {
    const admin = await db.roles.findUniqueOrThrow({
      where: { codigo: 'ADMINISTRADOR' },
    });
    const permission = await db.permisos.findUniqueOrThrow({
      where: { codigo: 'roles.gestionar' },
    });
    await db.usuario_rol.create({ data: { usuario_id: id, rol_id: admin.id } });
    const session = await cookie();
    await request(app.getHttpServer())
      .get('/seguridad/roles')
      .set('Cookie', session)
      .expect(200);
    await db.usuario_permiso.create({
      data: {
        usuario_id: id,
        permiso_id: permission.id,
        efecto: 'DENEGAR',
        asignado_por: id,
      },
    });
    await request(app.getHttpServer())
      .get('/seguridad/roles')
      .set('Cookie', session)
      .expect(403);
    const response = await request(app.getHttpServer())
      .get('/menu')
      .set('Cookie', session)
      .expect(200);
    const modules = response.body as { opciones: { codigo: string }[] }[];
    expect(
      modules.flatMap((module) =>
        module.opciones.map((option) => option.codigo),
      ),
    ).not.toContain('ROLES_PERMISOS');
  });

  it('respeta concesiones directas y su vencimiento', async () => {
    const permission = await db.permisos.findUniqueOrThrow({
      where: { codigo: 'roles.gestionar' },
    });
    const session = await cookie();
    await db.usuario_permiso.create({
      data: {
        usuario_id: id,
        permiso_id: permission.id,
        efecto: 'PERMITIR',
        asignado_por: id,
        asignado_en: new Date(Date.now() - 120_000),
      },
    });
    await request(app.getHttpServer())
      .get('/seguridad/roles')
      .set('Cookie', session)
      .expect(200);
    await db.usuario_permiso.update({
      where: {
        usuario_id_permiso_id: { usuario_id: id, permiso_id: permission.id },
      },
      data: { expira_en: new Date(Date.now() - 60_000) },
    });
    await request(app.getHttpServer())
      .get('/seguridad/roles')
      .set('Cookie', session)
      .expect(403);
  });

  it('protege menú y catálogo cuando no hay sesión', async () => {
    await request(app.getHttpServer()).get('/menu').expect(401);
    await request(app.getHttpServer()).get('/seguridad/roles').expect(401);
  });
});

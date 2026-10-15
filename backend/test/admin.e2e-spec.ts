import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { hash, compare } from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { ulid } from 'ulid';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
const integration = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
integration('Administración con MariaDB', () => {
  const db = new PrismaClient();
  const prefix = `TEST_ADM_${randomUUID().slice(0, 8)}`;
  const password = randomUUID();
  let actor: bigint;
  let app: INestApplication<App>;
  let cookie: string;
  let role: number;
  beforeAll(async () => {
    const admin = await db.roles.findUniqueOrThrow({
      where: { codigo: 'ADMINISTRADOR' },
    });
    role = (await db.roles.findUniqueOrThrow({ where: { codigo: 'MEDICO' } }))
      .id;
    actor = (
      await db.usuarios.create({
        data: {
          codigo_publico: ulid(),
          codigo_acceso: prefix,
          nombres: 'Prueba',
          apellidos: 'Administración',
          contrasena_hash: await hash(password, 12),
        },
      })
    ).id;
    await db.usuario_rol.create({
      data: { usuario_id: actor, rol_id: admin.id },
    });
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = mod.createNestApplication<INestApplication<App>>();
    configureApp(app);
    await app.init();
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-NutriTech-Request', '1')
      .send({ codigo_acceso: prefix, contrasena: password })
      .expect(200);
    cookie = (login.headers['set-cookie'] as unknown as string[])[0].split(
      ';',
    )[0];
  });
  it('gestiona comunidades con validación, duplicados, revisión concurrente y auditoría', async () => {
    const server = app.getHttpServer();
    const body = {
      nombre: prefix,
      municipio: 'Municipio de prueba',
      departamento: 'Departamento de prueba',
      activo: true,
    };
    try {
      await request(server).get('/admin/comunidades').expect(401);
      await request(server)
        .post('/admin/comunidades')
        .set('Cookie', cookie)
        .set('X-NutriTech-Request', '1')
        .send({ ...body, nombre: '  ' })
        .expect(400);
      const created = await request(server)
        .post('/admin/comunidades')
        .set('Cookie', cookie)
        .set('X-NutriTech-Request', '1')
        .send(body)
        .expect(201);
      const row = created.body as { id: string; revision: string };
      await request(server)
        .post('/admin/comunidades')
        .set('Cookie', cookie)
        .set('X-NutriTech-Request', '1')
        .send(body)
        .expect(409);
      await request(server)
        .post(`/admin/comunidades/${row.id}`)
        .set('Cookie', cookie)
        .set('X-NutriTech-Request', '1')
        .send({ ...body, activo: false, revision: row.revision })
        .expect(201);
      await request(server)
        .post(`/admin/comunidades/${row.id}`)
        .set('Cookie', cookie)
        .set('X-NutriTech-Request', '1')
        .send({ ...body, revision: row.revision })
        .expect(409);
      const list = await request(server)
        .get(`/admin/comunidades?buscar=${prefix}`)
        .set('Cookie', cookie)
        .expect(200);
      expect(list.body).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: row.id, activo: false }),
        ]),
      );
      expect(
        await db.registros_auditoria.count({
          where: {
            usuario_id: actor,
            entidad: 'comunidades',
            entidad_id: row.id,
          },
        }),
      ).toBe(2);
      await db.usuario_rol.deleteMany({ where: { usuario_id: actor } });
      await request(server)
        .get('/admin/comunidades')
        .set('Cookie', cookie)
        .expect(403);
    } finally {
      const admin = await db.roles.findUniqueOrThrow({
        where: { codigo: 'ADMINISTRADOR' },
      });
      await db.usuario_rol.upsert({
        where: { usuario_id_rol_id: { usuario_id: actor, rol_id: admin.id } },
        update: {},
        create: { usuario_id: actor, rol_id: admin.id },
      });
      await db.comunidades.deleteMany({ where: { nombre: prefix } });
    }
  });
  afterAll(async () => {
    const users = await db.usuarios.findMany({
      where: { codigo_acceso: { startsWith: prefix } },
      select: { id: true },
    });
    const ids = users.map((u) => u.id);
    await db.registros_auditoria.deleteMany({
      where: { usuario_id: { in: ids } },
    });
    await db.usuario_permiso.deleteMany({
      where: {
        OR: [{ usuario_id: { in: ids } }, { asignado_por: { in: ids } }],
      },
    });
    await db.sesiones_usuario.deleteMany({
      where: { usuario_id: { in: ids } },
    });
    await db.usuario_rol.deleteMany({ where: { usuario_id: { in: ids } } });
    await db.usuarios.deleteMany({
      where: { id: { in: ids.filter((id) => id !== actor) } },
    });
    await db.usuarios.deleteMany({ where: { id: actor } });
    await db.opciones_menu.deleteMany({
      where: { codigo: prefix.toUpperCase() },
    });
    if (app) await app.close();
    await db.$disconnect();
  });
  const get = (url: string) =>
    request(app.getHttpServer()).get(url).set('Cookie', cookie);
  const post = (url: string, body: unknown) =>
    request(app.getHttpServer())
      .post(url)
      .set('Cookie', cookie)
      .set('X-NutriTech-Request', '1')
      .send(body as object);
  it('crea sin exponer secretos, valida duplicados y exige CSRF', async () => {
    const body = {
      codigo_acceso: prefix + '_u',
      nombres: 'Cuenta',
      apellidos: 'Ficticia',
      contrasena: password,
      roles: [role],
    };
    await request(app.getHttpServer())
      .post('/admin/usuarios')
      .set('Cookie', cookie)
      .send(body)
      .expect(403);
    await post('/admin/usuarios', { ...body, contrasena: 'corta' }).expect(400);
    await post('/admin/usuarios', {
      ...body,
      contrasena: 'é'.repeat(40),
    }).expect(400);
    await post('/admin/usuarios', body).expect(201);
    await post('/admin/usuarios', body).expect(409);
    const response = await get('/admin/usuarios?buscar=' + prefix).expect(200);
    expect(JSON.stringify(response.body)).not.toContain('contrasena');
    expect(JSON.stringify(response.body)).not.toContain(password);
    const stored = await db.usuarios.findUniqueOrThrow({
      where: { codigo_acceso: body.codigo_acceso },
    });
    expect(await compare(password, stored.contrasena_hash)).toBe(true);
  });
  it('revoca sesiones al editar, evita sobrescrituras y restablece contraseñas', async () => {
    const row = await db.usuarios.findUniqueOrThrow({
      where: { codigo_acceso: prefix + '_u' },
    });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-NutriTech-Request', '1')
      .send({ codigo_acceso: row.codigo_acceso, contrasena: password })
      .expect(200);
    const childCookie = (
      login.headers['set-cookie'] as unknown as string[]
    )[0].split(';')[0];
    type Listed = { datos: { codigo_publico: string; revision: string }[] };
    const listed = (await get('/admin/usuarios?buscar=' + row.codigo_acceso))
      .body as Listed;
    const revision = listed.datos[0].revision;
    const dto = {
      nombres: 'Actualizado',
      apellidos: 'Ficticio',
      estado: 'ACTIVO',
      roles: [role],
      motivo: 'Corrección de prueba',
      revision,
    };
    await post('/admin/usuarios/' + row.codigo_publico, dto).expect(201);
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', childCookie)
      .expect(401);
    await post('/admin/usuarios/' + row.codigo_publico, dto).expect(409);
    const newPassword = randomUUID();
    await post(`/admin/usuarios/${row.codigo_publico}/contrasena`, {
      contrasena: newPassword,
    }).expect(201);
    expect(
      await compare(
        newPassword,
        (await db.usuarios.findUniqueOrThrow({ where: { id: row.id } }))
          .contrasena_hash,
      ),
    ).toBe(true);
    const logs = await db.registros_auditoria.findMany({
      where: { usuario_id: actor },
    });
    expect(
      JSON.stringify(logs, (_, v: unknown) =>
        typeof v === 'bigint' ? v.toString() : v,
      ),
    ).not.toContain(newPassword);
    const me = (await get('/admin/usuarios?buscar=' + prefix)).body as Listed;
    const own = me.datos.find((x) => x.codigo_publico !== row.codigo_publico)!;
    await post('/admin/usuarios/' + own.codigo_publico, {
      ...dto,
      revision: own.revision,
    }).expect(409);
  });
  it('edita opciones existentes con concurrencia y protege el acceso al menú', async () => {
    const mod = await db.modulos_menu.findFirstOrThrow();
    await db.opciones_menu.create({
      data: {
        codigo: prefix.toUpperCase(),
        nombre: 'Prueba',
        tipo: 'ENLACE',
        ruta: '/dashboard',
        modulo_menu_id: mod.id,
      },
    });
    type Menu = {
      codigo: string;
      nombre: string;
      orden: number;
      visible: boolean;
      activo: boolean;
      revision: string;
    };
    const rows = (await get('/admin/menus').expect(200)).body as Menu[];
    const row = rows.find((r) => r.codigo === prefix.toUpperCase())!;
    const dto = {
      nombre: 'Prueba editada',
      orden: 20,
      visible: false,
      activo: true,
      revision: row.revision,
    };
    await post('/admin/menus/' + row.codigo, dto).expect(201);
    await post('/admin/menus/' + row.codigo, dto).expect(409);
    const protectedRow = rows.find((r) => r.codigo === 'MENUS_GESTIONAR')!;
    await post('/admin/menus/MENUS_GESTIONAR', {
      ...dto,
      revision: protectedRow.revision,
    }).expect(409);
  });
  it('edita permisos de un rol de prueba y conserva los roles protegidos', async () => {
    const codigo = prefix.toUpperCase();
    const created = await db.roles.create({ data: { codigo, nombre: codigo } });
    try {
      type Catalog = { roles: { codigo: string; revision: string }[] };
      const rows = (await get('/admin/roles').expect(200)).body as Catalog;
      const revision = rows.roles.find((r) => r.codigo === codigo)!.revision;
      await post('/admin/roles/' + codigo, {
        permisos: ['no.existe'],
        revision,
        motivo: 'Prueba de validación',
      }).expect(400);
      await post('/admin/roles/' + codigo, {
        permisos: ['dashboard.ver'],
        revision,
        motivo: 'Asignación de prueba',
      }).expect(201);
      await post('/admin/roles/' + codigo, {
        permisos: [],
        revision,
        motivo: 'Cambio concurrente',
      }).expect(409);
      expect(
        await db.rol_permiso.count({ where: { rol_id: created.id } }),
      ).toBe(1);
      await post('/admin/roles/ADMINISTRADOR', {
        permisos: [],
        revision: rows.roles.find((r) => r.codigo === 'ADMINISTRADOR')!
          .revision,
        motivo: 'No debe permitirse',
      }).expect(409);
    } finally {
      await db.rol_permiso.deleteMany({ where: { rol_id: created.id } });
      await db.roles.delete({ where: { id: created.id } });
    }
  });
  it('protege administración, auditoría y respaldos con permisos', async () => {
    for (const route of ['usuarios', 'menus', 'auditoria', 'respaldos'])
      await request(app.getHttpServer())
        .get('/admin/' + route)
        .expect(401);
    await get('/admin/auditoria?pagina=0').expect(400);
    const audit = await get('/admin/auditoria').expect(200);
    expect(JSON.stringify(audit.body)).not.toContain('datos_anteriores');
    await get('/admin/respaldos').expect(200);
    for (const code of [
      'usuarios.ver',
      'menus.ver',
      'auditoria.ver',
      'respaldos.gestionar',
    ]) {
      const p = await db.permisos.findUniqueOrThrow({
        where: { codigo: code },
      });
      await db.usuario_permiso.create({
        data: {
          usuario_id: actor,
          asignado_por: actor,
          permiso_id: p.id,
          efecto: 'DENEGAR',
        },
      });
    }
    for (const route of ['usuarios', 'menus', 'auditoria', 'respaldos'])
      await get('/admin/' + route).expect(403);
    await post('/admin/respaldos', {}).expect(403);
  });
});

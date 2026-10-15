import 'dotenv/config';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { hash } from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { ulid } from 'ulid';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

// Solo modifica un usuario sintético creado por esta suite y lo retira al terminar.
const integration = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
integration('Consulta de patrones con MariaDB', () => {
  const db = new PrismaClient();
  const code = `TEST_PATTERN_${randomUUID().slice(0, 8)}`;
  const password = randomUUID();
  let id: bigint;
  let patternId: number;
  let ageId: number;
  let heightId: number;
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
    const pattern = await db.patrones_crecimiento.create({
      data: {
        codigo: code,
        nombre: code,
        version: 'TEST',
        organizacion_fuente: 'Datos sintéticos de prueba',
        referencia_documental: '<script>prueba</script>',
        activo: false,
        vigente_desde: new Date('2020-01-01'),
      },
    });
    patternId = pattern.id;
    ageId = (
      await db.tipos_indicador.findUniqueOrThrow({ where: { codigo: 'P_E' } })
    ).id;
    heightId = (
      await db.tipos_indicador.findUniqueOrThrow({ where: { codigo: 'P_T' } })
    ).id;
    await db.parametros_lms_edad.createMany({
      data: [
        { sexo_biologico: 'F', edad_dias: 0 },
        { sexo_biologico: 'F', edad_dias: 2 },
        { sexo_biologico: 'M', edad_dias: 1 },
      ].map((row) => ({
        ...row,
        sexo_biologico: row.sexo_biologico as 'F' | 'M',
        patron_id: patternId,
        indicador_id: ageId,
        valor_l: 1,
        valor_m: 1,
        valor_s: 1,
      })),
    });
    await db.parametros_lms_talla.createMany({
      data: [
        { tipo_medicion: 'LONGITUD_ACOSTADO', talla_cm: 50 },
        { tipo_medicion: 'TALLA_DE_PIE', talla_cm: 60.5 },
      ].map((row) => ({
        ...row,
        tipo_medicion: row.tipo_medicion as
          'LONGITUD_ACOSTADO' | 'TALLA_DE_PIE',
        sexo_biologico: 'F',
        patron_id: patternId,
        indicador_id: heightId,
        valor_l: 1,
        valor_m: 1,
        valor_s: 1,
      })),
    });
    await db.reglas_clasificacion.create({
      data: {
        patron_id: patternId,
        indicador_id: ageId,
        codigo: 'TEST_ONLY',
        etiqueta: 'Regla sintética inactiva',
        z_min: null,
        z_max: 0,
        incluye_max: true,
        nivel_revision: 'NINGUNO',
        color_hex: '#2563A6',
        orden: 1,
        activa: false,
      },
    });
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
          if (patternId) {
            await tx.parametros_lms_edad.deleteMany({
              where: { patron_id: patternId },
            });
            await tx.parametros_lms_talla.deleteMany({
              where: { patron_id: patternId },
            });
            await tx.reglas_clasificacion.deleteMany({
              where: { patron_id: patternId },
            });
            await tx.patrones_crecimiento.delete({ where: { id: patternId } });
          }
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

  function login(pass = password) {
    return request(app.getHttpServer())
      .post('/auth/login')
      .set('X-NutriTech-Request', '1')
      .set('Origin', 'http://127.0.0.1:5173')
      .send({ codigo_acceso: code, contrasena: pass });
  }

  async function cookie() {
    const response = await login().expect(200);
    return (response.headers['set-cookie'] as unknown as string[])[0].split(
      ';',
    )[0];
  }
  async function grant() {
    const p = await db.permisos.findUniqueOrThrow({
      where: { codigo: 'patrones.gestionar' },
    });
    await db.usuario_permiso.create({
      data: {
        usuario_id: id,
        permiso_id: p.id,
        asignado_por: id,
        efecto: 'PERMITIR',
        asignado_en: new Date(Date.now() - 1000),
      },
    });
    return p.id;
  }
  type Pattern = {
    codigo: string;
    activo: boolean;
    vigente_desde: string;
    indicadores: {
      codigo: string;
      parametros_edad: unknown[];
      parametros_talla: unknown[];
      reglas: unknown[];
    }[];
  };
  it('exige sesión y permiso de configuración', async () => {
    await request(app.getHttpServer()).get('/patrones').expect(401);
    await request(app.getHttpServer())
      .get('/patrones')
      .set('Cookie', await cookie())
      .expect(403);
  });
  it('protege la propuesta y la entrega sin activar ni modificar reglas', async () => {
    const path = '/patrones/propuesta-clasificacion';
    await request(app.getHttpServer()).get(path).expect(401);
    const session = await cookie();
    await request(app.getHttpServer())
      .get(path)
      .set('Cookie', session)
      .expect(403);
    const before = await db.reglas_clasificacion.findMany({
      where: { patron_id: patternId },
    });
    await grant();
    const response = await request(app.getHttpServer())
      .get(path)
      .set('Cookie', session)
      .expect(200);
    expect(response.body).toMatchObject({
      estado: 'BORRADOR',
      activa: false,
      revision_clinica: 'PENDIENTE',
      nivel_revision: null,
      genera_alerta: false,
    });
    expect((response.body as { reglas: unknown[] }).reglas).toHaveLength(20);
    expect(response.body).toHaveProperty('protocolo.permite_persistir', false);
    expect(response.body).toHaveProperty(
      'protocolo.revision_clinica',
      'PENDIENTE',
    );
    expect(
      (response.body as { protocolo: { casos: unknown[] } }).protocolo.casos,
    ).toHaveLength(9);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(
      await db.reglas_clasificacion.findMany({
        where: { patron_id: patternId },
      }),
    ).toEqual(before);
  });
  it('agrupa por sexo y método, preservando decimales, límites abiertos y reglas inactivas', async () => {
    await grant();
    const response = await request(app.getHttpServer())
      .get('/patrones')
      .set('Cookie', await cookie())
      .expect(200);
    const pattern = (response.body as Pattern[]).find(
      (row) => row.codigo === code,
    )!;
    expect(pattern.activo).toBe(false);
    expect(pattern.vigente_desde).toBe('2020-01-01');
    expect(pattern).not.toHaveProperty('id');
    expect(pattern).not.toHaveProperty('validado');
    const age = pattern.indicadores.find((row) => row.codigo === 'P_E')!;
    expect(age.parametros_edad).toEqual([
      { sexo: 'F', cantidad: 2, desde: 0, hasta: 2 },
      { sexo: 'M', cantidad: 1, desde: 1, hasta: 1 },
    ]);
    expect(age.reglas).toEqual([
      expect.objectContaining({
        activa: false,
        z_min: null,
        z_max: '0.000',
        incluye_max: true,
      }),
    ]);
    const height = pattern.indicadores.find((row) => row.codigo === 'P_T')!;
    expect(height.parametros_talla).toEqual([
      {
        sexo: 'F',
        tipo_medicion: 'LONGITUD_ACOSTADO',
        cantidad: 1,
        desde: '50.0',
        hasta: '50.0',
      },
      {
        sexo: 'F',
        tipo_medicion: 'TALLA_DE_PIE',
        cantidad: 1,
        desde: '60.5',
        hasta: '60.5',
      },
    ]);
    const missing = pattern.indicadores.find((row) => row.codigo === 'IMC_E')!;
    expect(missing.parametros_edad).toEqual([]);
    expect(missing.reglas).toEqual([]);
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it('aplica cambios de permiso sin volver a iniciar sesión', async () => {
    const permissionId = await grant();
    const session = await cookie();
    await request(app.getHttpServer())
      .get('/patrones')
      .set('Cookie', session)
      .expect(200);
    await db.usuario_permiso.update({
      where: {
        usuario_id_permiso_id: { usuario_id: id, permiso_id: permissionId },
      },
      data: { efecto: 'DENEGAR' },
    });
    await request(app.getHttpServer())
      .get('/patrones')
      .set('Cookie', session)
      .expect(403);
  });
  it('la consulta no activa el patrón ni modifica parámetros o reglas', async () => {
    await grant();
    const session = await cookie();
    await request(app.getHttpServer())
      .get('/patrones')
      .set('Cookie', session)
      .expect(200);
    expect(
      (
        await db.patrones_crecimiento.findUniqueOrThrow({
          where: { id: patternId },
        })
      ).activo,
    ).toBe(false);
    expect(
      await db.parametros_lms_edad.count({ where: { patron_id: patternId } }),
    ).toBe(3);
    expect(
      await db.reglas_clasificacion.count({
        where: { patron_id: patternId, activa: false },
      }),
    ).toBe(1);
  });
});

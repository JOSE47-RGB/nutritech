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
import { GrowthService } from '../src/growth/growth.service';
import { ServiceUnavailableException } from '@nestjs/common';
type HistoryResponse = Awaited<ReturnType<GrowthService['history']>>;
type ReferenceResponse = Awaited<ReturnType<GrowthService['reference']>>;
const integration = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
integration('Crecimiento con MariaDB y permisos', () => {
  const db = new PrismaClient();
  const prefix = `TEST_GROW_${randomUUID().slice(0, 8)}`;
  const password = randomUUID();
  const ids: bigint[] = [];
  let center: bigint;
  let app: INestApplication<App>;
  const cookies: string[] = [];
  let own: string, foreign: string;
  beforeAll(async () => {
    for (const [i, roleCode] of [
      'ADMINISTRADOR',
      'USUARIO_NORMAL',
      'USUARIO_NORMAL',
    ].entries()) {
      const role = await db.roles.findUniqueOrThrow({
        where: { codigo: roleCode },
      });
      const user = await db.usuarios.create({
        data: {
          codigo_publico: ulid(),
          codigo_acceso: `${prefix}_${i}`,
          nombres: 'Prueba',
          apellidos: 'Crecimiento',
          contrasena_hash: await hash(password, 12),
        },
      });
      ids.push(user.id);
      await db.usuario_rol.create({
        data: { usuario_id: user.id, rol_id: role.id },
      });
    }
    center = (
      await db.centros_salud.create({
        data: { codigo: prefix, nombre: 'Centro de prueba crecimiento' },
      })
    ).id;
    const mod = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = mod.createNestApplication<INestApplication<App>>();
    configureApp(app);
    await app.init();
    for (let i = 0; i < 3; i++) {
      const res = await request(app.getHttpServer())
        .post('/auth/login')
        .set('X-NutriTech-Request', '1')
        .send({ codigo_acceso: `${prefix}_${i}`, contrasena: password })
        .expect(200);
      cookies.push(
        (res.headers['set-cookie'] as unknown as string[])[0].split(';')[0],
      );
    }
    for (const [i, actor] of [ids[1], ids[2]].entries()) {
      const child = await db.ninos.create({
        data: {
          codigo_publico: ulid(),
          codigo_expediente: `${prefix}_${i}`,
          primer_nombre: prefix,
          primer_apellido: `Prueba${i}`,
          fecha_nacimiento: new Date('2024-01-01'),
          sexo_biologico: 'F',
          registrado_por: actor,
          certificado_hash: Buffer.from(
            randomUUID().replaceAll('-', ''),
            'hex',
          ),
          certificado_cifrado: Buffer.from('fixture'),
          certificado_ultimos4: 'TEST',
        },
      });
      if (i === 0) own = child.codigo_publico;
      else foreign = child.codigo_publico;
      const times = [
        '2024-02-01T05:59:59Z',
        '2024-02-01T06:00:00Z',
        '2024-02-20T12:00:00Z',
      ];
      for (const [j, timestamp] of times.entries())
        await db.evaluaciones_nutricionales.create({
          data: {
            codigo_publico: ulid(),
            nino_id: child.id,
            centro_salud_id: center,
            registrado_por: actor,
            evaluado_en: new Date(timestamp),
            edad_dias: j === 0 ? 30 : j === 1 ? 31 : 50,
            peso_kg: 4 + j / 10,
            talla_cm: 55,
            tipo_medicion: 'LONGITUD_ACOSTADO',
            edema: j === 2 ? 'DESCONOCIDO' : 'NO',
            lugar_evaluacion: 'CLINICA',
          },
        });
      if (i === 0)
        for (const state of ['REGISTRADA', 'ANULADA'] as const)
          await db.evaluaciones_nutricionales.create({
            data: {
              codigo_publico: ulid(),
              nino_id: child.id,
              centro_salud_id: center,
              registrado_por: ids[0],
              evaluado_en: new Date('2024-02-25T12:00:00Z'),
              edad_dias: 55,
              peso_kg: 4.5,
              talla_cm: 56,
              tipo_medicion: 'LONGITUD_ACOSTADO',
              edema: 'NO',
              lugar_evaluacion: 'CLINICA',
              estado: state,
              ...(state === 'ANULADA'
                ? {
                    anulada_por: ids[0],
                    anulada_en: new Date(),
                    motivo_anulacion: 'Prueba de exclusión de anuladas',
                  }
                : {}),
            },
          });
    }
  });
  afterAll(async () => {
    if (app) await app.close();
    try {
      await db.$transaction(async (tx) => {
        await tx.evaluaciones_nutricionales.deleteMany({
          where: { registrado_por: { in: ids } },
        });
        await tx.ninos.deleteMany({ where: { registrado_por: { in: ids } } });
        await tx.registros_auditoria.deleteMany({
          where: { usuario_id: { in: ids } },
        });
        await tx.sesiones_usuario.deleteMany({
          where: { usuario_id: { in: ids } },
        });
        await tx.usuario_rol.deleteMany({ where: { usuario_id: { in: ids } } });
        await tx.usuario_permiso.deleteMany({
          where: { usuario_id: { in: ids } },
        });
        await tx.usuarios.deleteMany({ where: { id: { in: ids } } });
        if (center) await tx.centros_salud.delete({ where: { id: center } });
      });
    } finally {
      await db.$disconnect();
    }
  });
  const get = (url: string, user = 1) =>
    request(app.getHttpServer()).get(url).set('Cookie', cookies[user]);
  it('rechaza acceso anónimo y al historial administrativo desde usuario normal', async () => {
    await request(app.getHttpServer()).get('/crecimiento/ninos').expect(401);
    await get('/crecimiento/ninos').expect(403);
    await request(app.getHttpServer())
      .get('/crecimiento/tabla?sexo=M')
      .expect(401);
    await get('/crecimiento/tabla?sexo=M').expect(403);
    await request(app.getHttpServer())
      .get('/mi-portal/crecimiento/tabla?sexo=M')
      .expect(401);
  });
  it('entrega la misma tabla mensual verificada en Inicio para ambos roles', async () => {
    for (const sex of ['M', 'F']) {
      const normal = await get(
        `/mi-portal/crecimiento/tabla?sexo=${sex}`,
      ).expect(200);
      const admin = await get(`/crecimiento/tabla?sexo=${sex}`, 0).expect(200);
      expect(normal.body).toEqual(admin.body);
      const body = normal.body as ReturnType<GrowthService['table']>;
      expect(body.filas).toHaveLength(61);
      expect(body.filas.every((row) => row.sexo === sex)).toBe(true);
      expect(body.filas[24].tipo_medicion).toBe('TALLA_DE_PIE');
      expect(body.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
    await get('/mi-portal/crecimiento/tabla?sexo=X').expect(400);
    await get('/mi-portal/crecimiento/tabla').expect(400);
  });
  it('permite la tabla al usuario normal sin permiso de captura y conserva la protección del historial', async () => {
    const permission = await db.permisos.findUniqueOrThrow({
      where: { codigo: 'evaluaciones.crear' },
    });
    await db.usuario_permiso.create({
      data: {
        usuario_id: ids[2],
        permiso_id: permission.id,
        efecto: 'DENEGAR',
        asignado_por: ids[0],
        motivo: 'Prueba de tabla informativa sin captura',
      },
    });
    try {
      for (const sex of ['M', 'F']) {
        const response = await get(
          `/mi-portal/crecimiento/tabla?sexo=${sex}`,
          2,
        ).expect(200);
        expect(
          (response.body as ReturnType<GrowthService['table']>).filas,
        ).toHaveLength(61);
      }
      await get('/mi-portal/crecimiento/ninos', 2).expect(403);
      await get(`/mi-portal/crecimiento/ninos/${foreign}`, 2).expect(403);
      await get(
        '/mi-portal/crecimiento/referencia?sexo=M&edad_dias=0',
        2,
      ).expect(403);
      await get('/crecimiento/ninos', 2).expect(403);
    } finally {
      await db.usuario_permiso.deleteMany({
        where: { usuario_id: ids[2], permiso_id: permission.id },
      });
    }
  });
  it('limita búsquedas y lectura directa al alcance de la cuenta normal', async () => {
    const list = await get(
      `/mi-portal/crecimiento/ninos?busqueda=${prefix}`,
    ).expect(200);
    expect(list.body).toEqual([
      expect.objectContaining({ codigo_publico: own }),
    ]);
    await get(`/mi-portal/crecimiento/ninos/${foreign}`).expect(404);
    await get(`/mi-portal/crecimiento/ninos/${own}`, 2).expect(404);
  });
  it('admin ve las mediciones autorizadas; portal solo las propias; anuladas excluidas', async () => {
    const admin = await get(`/crecimiento/ninos/${own}`, 0).expect(200);
    expect((admin.body as HistoryResponse).total).toBe(4);
    const portal = await get(`/mi-portal/crecimiento/ninos/${own}`).expect(200);
    expect((portal.body as HistoryResponse).total).toBe(3);
    expect((portal.body as HistoryResponse).puntos).toHaveLength(2);
    expect((portal.body as HistoryResponse).puntos[1].cantidad).toBe(2);
    expect((portal.body as HistoryResponse).puntos[1].ultima.peso_kg).toBe(4.2);
    expect((portal.body as HistoryResponse).puntos[1].ultima.aviso).toMatch(
      /Falta revisar/,
    );
  });
  it('filtra un día local y agrupa año/mes/día sin perder los registros originales', async () => {
    const day = await get(
      `/mi-portal/crecimiento/ninos/${own}?desde=2024-01-31&hasta=2024-01-31&agrupar=dia`,
    ).expect(200);
    expect((day.body as HistoryResponse).total).toBe(1);
    expect((day.body as HistoryResponse).mediciones[0].fecha).toBe(
      '2024-01-31',
    );
    const year = await get(
      `/mi-portal/crecimiento/ninos/${own}?agrupar=ano`,
    ).expect(200);
    expect((year.body as HistoryResponse).puntos).toHaveLength(1);
    expect((year.body as HistoryResponse).puntos[0].cantidad).toBe(3);
    expect((year.body as HistoryResponse).mediciones).toHaveLength(3);
    const empty = await get(
      `/mi-portal/crecimiento/ninos/${own}?desde=2025-01-01`,
    ).expect(200);
    expect((empty.body as HistoryResponse).total).toBe(0);
    await get(`/mi-portal/crecimiento/ninos/${own}?hasta=2025-02-29`).expect(
      400,
    );
  });
  it('usa la misma referencia exacta por sexo/edad en ambos portales y rechaza extrapolación', async () => {
    const normal = await get(
      '/mi-portal/crecimiento/referencia?sexo=F&edad_dias=0',
    ).expect(200);
    const admin = await get(
      '/crecimiento/referencia?sexo=F&edad_dias=0',
      0,
    ).expect(200);
    expect(normal.body).toEqual(admin.body);
    expect(
      (normal.body as ReferenceResponse).referencia.mediana_kg,
    ).toBeCloseTo(3.2322, 4);
    await get('/mi-portal/crecimiento/referencia?sexo=F&edad_dias=1827').expect(
      400,
    );
    await get('/mi-portal/crecimiento/referencia?sexo=M&edad_dias=1826').expect(
      200,
    );
  });
  it('si faltan referencias, conserva el historial sin inventar valores', async () => {
    const mock = jest
      .spyOn(app.get(GrowthService), 'references')
      .mockRejectedValue(new ServiceUnavailableException());
    try {
      const response = await get(`/mi-portal/crecimiento/ninos/${own}`).expect(
        200,
      );
      expect((response.body as HistoryResponse).aviso_referencia).toBeTruthy();
      expect(
        (response.body as HistoryResponse).mediciones[0].referencia,
      ).toBeNull();
      await get('/mi-portal/crecimiento/referencia?sexo=F&edad_dias=0').expect(
        503,
      );
    } finally {
      mock.mockRestore();
    }
  });
});

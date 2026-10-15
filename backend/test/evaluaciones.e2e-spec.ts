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

const integration = process.env.RUN_DB_TESTS === '1' ? describe : describe.skip;
integration('Evaluaciones manuales con MariaDB', () => {
  const db = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const code = `TEST_EVAL_${suffix}`;
  const password = randomUUID();
  let id: bigint;
  let community: bigint;
  let center: bigint;
  let app: INestApplication<App>;
  let cookie: string;

  const child = () => ({
    certificado: `TEST${randomUUID().replaceAll('-', '')}`,
    primer_nombre: 'Prueba',
    primer_apellido: `Infantil${suffix}`,
    fecha_nacimiento: '2024-02-29',
    sexo_biologico: 'F',
  });

  beforeAll(async () => {
    const user = await db.usuarios.create({
      data: {
        codigo_publico: ulid(),
        codigo_acceso: code,
        nombres: 'Prueba',
        apellidos: 'Niños',
        contrasena_hash: await hash(password, 12),
      },
    });
    id = user.id;
    center = (
      await db.centros_salud.create({
        data: {
          codigo: `TEST_EVAL_${suffix}`,
          nombre: `Centro de prueba ${suffix}`,
        },
      })
    ).id;
    await db.usuarios.update({
      where: { id },
      data: { centro_salud_id: center },
    });
    const role = await db.roles.findUniqueOrThrow({
      where: { codigo: 'ADMINISTRADOR' },
    });
    await db.usuario_rol.create({ data: { usuario_id: id, rol_id: role.id } });
    community = (
      await db.comunidades.create({ data: { nombre: `TEST_${suffix}` } })
    ).id;
  });

  beforeEach(async () => {
    await db.usuario_permiso.deleteMany({ where: { usuario_id: id } });
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
    const result = await request(app.getHttpServer())
      .post('/auth/login')
      .set('X-NutriTech-Request', '1')
      .send({ codigo_acceso: code, contrasena: password })
      .expect(200);
    cookie = (result.headers['set-cookie'] as unknown as string[])[0].split(
      ';',
    )[0];
  });
  afterEach(async () => {
    if (app) await app.close();
  });
  afterAll(async () => {
    try {
      if (id)
        await db.$transaction(async (tx) => {
          await tx.reportes_generados.deleteMany({
            where: { generado_por: id },
          });
          await tx.$executeRaw`DELETE h FROM historial_alerta h JOIN alertas a ON a.id=h.alerta_id JOIN orientaciones_guardadas o ON o.id=a.orientacion_id WHERE o.guardado_por=${id}`;
          await tx.$executeRaw`DELETE a FROM alertas a JOIN orientaciones_guardadas o ON o.id=a.orientacion_id WHERE o.guardado_por=${id}`;
          await tx.$executeRaw`DELETE FROM valoraciones_medicas WHERE medico_id=${id}`;
          await tx.$executeRaw`DELETE FROM orientaciones_guardadas WHERE guardado_por=${id}`;
          await tx.evaluaciones_nutricionales.deleteMany({
            where: { registrado_por: id },
          });
          await tx.nino_responsable.deleteMany({
            where: { ninos: { registrado_por: id } },
          });
          await tx.responsables.deleteMany({
            where: { nombres: `Responsable${suffix}` },
          });
          await tx.ninos.deleteMany({ where: { registrado_por: id } });
          await tx.registros_auditoria.deleteMany({
            where: { usuario_id: id },
          });
          await tx.usuario_permiso.deleteMany({ where: { usuario_id: id } });
          await tx.usuario_rol.deleteMany({ where: { usuario_id: id } });
          await tx.sesiones_usuario.deleteMany({ where: { usuario_id: id } });
          await tx.usuarios.delete({ where: { id } });
          if (center) await tx.centros_salud.delete({ where: { id: center } });
          if (community)
            await tx.comunidades.delete({ where: { id: community } });
        });
    } finally {
      await db.$disconnect();
    }
  });

  function create(body: object) {
    return request(app.getHttpServer())
      .post('/ninos')
      .set('Cookie', cookie)
      .set('X-NutriTech-Request', '1')
      .send(body);
  }

  async function measurement() {
    const born = new Date();
    born.setUTCFullYear(born.getUTCFullYear() - 2);
    born.setUTCDate(1);
    const result = await create({
      ...child(),
      fecha_nacimiento: born.toISOString().slice(0, 10),
    }).expect(201);
    return {
      nino_codigo: (result.body as { codigo_publico: string }).codigo_publico,
      centro_salud_id: center.toString(),
      evaluado_en: new Date(Date.now() - 60000).toISOString(),
      peso_kg: 12.35,
      talla_cm: 85.25,
      tipo_medicion: 'TALLA_DE_PIE',
      edema: 'NO',
      lugar_evaluacion: 'CLINICA',
    };
  }
  function post(body: object) {
    return request(app.getHttpServer())
      .post('/evaluaciones')
      .set('Cookie', cookie)
      .set('X-NutriTech-Request', '1')
      .send(body);
  }
  function get(path: string) {
    return request(app.getHttpServer()).get(path).set('Cookie', cookie);
  }
  async function deny(codigo: string) {
    const p = await db.permisos.findUniqueOrThrow({ where: { codigo } });
    await db.usuario_permiso.create({
      data: {
        usuario_id: id,
        permiso_id: p.id,
        asignado_por: id,
        efecto: 'DENEGAR',
      },
    });
  }

  it('conserva orientación con precisión, autor e integridad sin duplicar ni validar', async () => {
    const body = await measurement();
    const created = await post(body).expect(201);
    const code = (created.body as { codigo_publico: string }).codigo_publico;
    const url = `/evaluaciones/${code}/orientaciones`;
    const save = () =>
      request(app.getHttpServer())
        .post(url)
        .set('Cookie', cookie)
        .set('X-NutriTech-Request', '1');
    await request(app.getHttpServer())
      .post(url)
      .set('X-NutriTech-Request', '1')
      .expect(401);
    await request(app.getHttpServer())
      .post(url)
      .set('Cookie', cookie)
      .expect(403);
    const [a, b] = await Promise.all([save().expect(201), save().expect(201)]);
    expect(a.body).toHaveProperty(
      'codigo_publico',
      (b.body as { codigo_publico: string }).codigo_publico,
    );
    expect(a.body).toHaveProperty('autor', `TEST_EVAL_${suffix}`);
    expect(a.body).toHaveProperty('contenido.revision_medica', 'PENDIENTE');
    expect(a.body).toHaveProperty('contenido.orientacion.persistida', true);
    const saved = a.body as {
      contenido: { indicadores: { P_E: { z: number } } };
    };
    expect(saved.contenido.indicadores.P_E.z).not.toBe(
      Number(saved.contenido.indicadores.P_E.z.toFixed(2)),
    );
    const history = await get(url).expect(200);
    expect(history.body).toHaveLength(1);
    await deny('evaluaciones.crear');
    await save().expect(403);
    await get(url).expect(200);
    await db.evaluaciones_nutricionales.update({
      where: { codigo_publico: code },
      data: {
        estado: 'ANULADA',
        anulada_por: id,
        anulada_en: new Date(),
        motivo_anulacion: 'Prueba de trazabilidad',
      },
    });
    await db.usuario_permiso.deleteMany({ where: { usuario_id: id } });
    await save().expect(409);
    await get(url).expect(200);
    await db.$executeRaw`UPDATE orientaciones_guardadas SET contenido=CONCAT(contenido,' ') WHERE guardado_por=${id}`;
    await get(url).expect(409);
  });

  it('registra valoraciones solo con permiso, conserva historial y rechaza conflictos', async () => {
    const created = await post(await measurement()).expect(201);
    const evaluation = (created.body as { codigo_publico: string })
      .codigo_publico;
    const saved = await request(app.getHttpServer())
      .post(`/evaluaciones/${evaluation}/orientaciones`)
      .set('Cookie', cookie)
      .set('X-NutriTech-Request', '1')
      .expect(201);
    const orientation = (saved.body as { codigo_publico: string })
      .codigo_publico;
    const url = `/evaluaciones/${evaluation}/orientaciones/${orientation}/valoraciones`;
    const body = {
      solicitud_id: randomUUID(),
      decision: 'DIFIERE',
      valoracion: 'Interpretación de prueba por el profesional.',
      acciones: 'Revisar mediciones y antecedentes registrados.',
    };
    const submit = (value: object = body) =>
      request(app.getHttpServer())
        .post(url)
        .set('Cookie', cookie)
        .set('X-NutriTech-Request', '1')
        .send(value);
    await submit().expect(403);
    const permission = await db.permisos.findUniqueOrThrow({
      where: { codigo: 'evaluaciones.valorar' },
    });
    await db.usuario_permiso.create({
      data: {
        usuario_id: id,
        permiso_id: permission.id,
        asignado_por: id,
        efecto: 'PERMITIR',
      },
    });
    await request(app.getHttpServer())
      .post(url)
      .set('X-NutriTech-Request', '1')
      .send(body)
      .expect(401);
    await request(app.getHttpServer())
      .post(url)
      .set('Cookie', cookie)
      .send(body)
      .expect(403);
    await submit({ ...body, valoracion: '   ' }).expect(400);
    await submit({ ...body, decision: 'APROBACION_AUTOMATICA' }).expect(400);
    const [first, repeated] = await Promise.all([
      submit().expect(201),
      submit().expect(201),
    ]);
    expect(first.body).toEqual(repeated.body);
    await submit({
      ...body,
      acciones: 'Contenido diferente con la misma solicitud.',
    }).expect(409);
    await submit({
      ...body,
      solicitud_id: randomUUID(),
      decision: 'COINCIDE',
    }).expect(201);
    const history = await get(url).expect(200);
    expect((history.body as { datos: unknown[] }).datos).toHaveLength(2);
    expect(history.body).toHaveProperty('puede_valorar', true);
    const unchanged = await get(
      `/evaluaciones/${evaluation}/orientaciones`,
    ).expect(200);
    expect(
      (unchanged.body as { contenido_sha256: string }[])[0].contenido_sha256,
    ).toBe((saved.body as { contenido_sha256: string }).contenido_sha256);
    await get(
      `/evaluaciones/${ulid()}/orientaciones/${orientation}/valoraciones`,
    ).expect(404);
    await db.evaluaciones_nutricionales.update({
      where: { codigo_publico: evaluation },
      data: {
        estado: 'ANULADA',
        anulada_por: id,
        anulada_en: new Date(),
        motivo_anulacion: 'Prueba de valoración',
      },
    });
    await submit({ ...body, solicitud_id: randomUUID() }).expect(409);
    expect((await get(url).expect(200)).body).toHaveProperty(
      'puede_valorar',
      false,
    );
    await deny('evaluaciones.ver');
    await get(url).expect(403);
  });

  it('genera avisos deduplicados y conserva seguimiento con concurrencia y permisos', async () => {
    const body = await measurement();
    const created = await post({ ...body, edema: 'SI' }).expect(201);
    const evaluation = (created.body as { codigo_publico: string })
      .codigo_publico;
    const save = () =>
      request(app.getHttpServer())
        .post(`/evaluaciones/${evaluation}/orientaciones`)
        .set('Cookie', cookie)
        .set('X-NutriTech-Request', '1');
    const first = await save().expect(201);
    const orientation = (first.body as { codigo_publico: string })
      .codigo_publico;
    await save().expect(201);
    const alerts = await db.alertas.findMany({
      where: { orientacion: { codigo_publico: orientation } },
    });
    expect(alerts).toHaveLength(1);
    const code = alerts[0].codigo_publico;
    const path = `/alertas/${code}`;
    await request(app.getHttpServer()).get('/alertas').expect(401);
    expect(
      (await get('/alertas?estado=PENDIENTE').expect(200)).headers[
        'cache-control'
      ],
    ).toBe('no-store');
    await get('/alertas?estado=INVALIDO').expect(400);
    const change = (estado: string, revision: number) =>
      request(app.getHttpServer())
        .post(`${path}/estado`)
        .set('Cookie', cookie)
        .set('X-NutriTech-Request', '1')
        .send({
          estado,
          revision,
          comentario: 'Seguimiento documentado durante la prueba.',
        });
    await change('ATENDIDA', 0).expect(409);
    await request(app.getHttpServer())
      .post(`${path}/estado`)
      .set('Cookie', cookie)
      .send({
        estado: 'EN_REVISION',
        revision: 0,
        comentario: 'Una justificación válida.',
      })
      .expect(403);
    const [a, b] = await Promise.all([
      change('EN_REVISION', 0),
      change('EN_REVISION', 0),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    await change('ATENDIDA', 1).expect(201);
    await change('EN_REVISION', 2).expect(201);
    await change('DESCARTADA', 3).expect(201);
    const detail = await get(path).expect(200);
    expect((detail.body as { historial: unknown[] }).historial).toHaveLength(5);
    expect(detail.body).toHaveProperty(
      'orientacion.codigo_publico',
      evaluation,
    );
    await save().expect(201);
    expect(
      (await db.alertas.findUniqueOrThrow({ where: { codigo_publico: code } }))
        .estado,
    ).toBe('DESCARTADA');
    await deny('alertas.atender');
    await change('EN_REVISION', 4).expect(403);
    await get(path).expect(200);
    await deny('alertas.ver');
    await get(path).expect(403);
    await get('/alertas').expect(403);
    await db.usuario_permiso.deleteMany({ where: { usuario_id: id } });
    await db.evaluaciones_nutricionales.update({
      where: { codigo_publico: evaluation },
      data: {
        estado: 'ANULADA',
        anulada_por: id,
        anulada_en: new Date(),
        motivo_anulacion: 'Prueba de alerta',
      },
    });
    await change('EN_REVISION', 4).expect(409);
  });

  it('conserva una medida extrema y genera su alerta aunque el edema no se haya revisado', async () => {
    const measured = new Date(Date.now() - 60000).toISOString();
    const birth = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Guatemala',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(measured));
    const createdChild = await create({
      ...child(),
      fecha_nacimiento: birth,
      sexo_biologico: 'M',
    }).expect(201);
    const created = await post({
      nino_codigo: (createdChild.body as { codigo_publico: string })
        .codigo_publico,
      centro_salud_id: center.toString(),
      evaluado_en: measured,
      peso_kg: 4,
      talla_cm: 30,
      tipo_medicion: 'LONGITUD_ACOSTADO',
      edema: 'DESCONOCIDO',
      lugar_evaluacion: 'CLINICA',
    }).expect(201);
    const code = (created.body as { codigo_publico: string }).codigo_publico;
    const save = () =>
      request(app.getHttpServer())
        .post(`/evaluaciones/${code}/orientaciones`)
        .set('Cookie', cookie)
        .set('X-NutriTech-Request', '1');
    const first = await save().expect(201);
    const second = await save().expect(201);
    expect(second.body).toEqual(first.body);
    expect(first.body).toHaveProperty('contenido.entrada.talla_cm', '30');
    expect(first.body).toHaveProperty(
      'contenido.guia_familiar.estado_edema',
      'DESCONOCIDO',
    );
    expect(first.body).toHaveProperty(
      'contenido.guia_familiar.titulo',
      'Revisar la longitud/talla: 30 cm',
    );
    const alerts = await db.alertas.findMany({
      where: {
        orientacion: {
          codigo_publico: (first.body as { codigo_publico: string })
            .codigo_publico,
        },
      },
    });
    expect(alerts.map((a) => a.regla_aviso).sort()).toEqual([
      'EDEMA_DESCONOCIDO',
      'P_T:TALLA_FUERA_DE_COBERTURA',
      'T_E:CALIDAD',
    ]);
    expect(
      alerts.find((a) => a.regla_aviso === 'T_E:CALIDAD')?.mensaje,
    ).toContain('conserva el valor real');
    const original = await db.evaluaciones_nutricionales.findUniqueOrThrow({
      where: { codigo_publico: code },
    });
    expect(Number(original.talla_cm)).toBe(30);
  });

  it('archiva el reporte con permisos, integridad e historial completo sin recalcular', async () => {
    const created = await post({
      ...(await measurement()),
      edema: 'SI',
    }).expect(201);
    const evaluation = (created.body as { codigo_publico: string })
      .codigo_publico;
    const saved = await request(app.getHttpServer())
      .post(`/evaluaciones/${evaluation}/orientaciones`)
      .set('Cookie', cookie)
      .set('X-NutriTech-Request', '1')
      .expect(201);
    const orientation = (saved.body as { codigo_publico: string })
      .codigo_publico;
    const source = await db.orientaciones_guardadas.findUniqueOrThrow({
      where: { codigo_publico: orientation },
    });
    await db.valoraciones_medicas.createMany({
      data: Array.from({ length: 21 }, (_, index) => ({
        codigo_publico: ulid(),
        orientacion_id: source.id,
        medico_id: id,
        solicitud_id: randomUUID(),
        decision: 'REQUIERE_INFORMACION',
        valoracion: `Valoración de prueba ${index + 1}: <script>alert(1)</script>`,
        acciones: 'Revisar los antecedentes registrados.',
      })),
    });
    const body = {
      evaluacion: evaluation,
      orientacion: orientation,
      solicitud_id: randomUUID(),
    };
    const generate = (value: object = body) =>
      request(app.getHttpServer())
        .post('/reportes')
        .set('Cookie', cookie)
        .set('X-NutriTech-Request', '1')
        .send(value);
    await request(app.getHttpServer())
      .post('/reportes')
      .set('X-NutriTech-Request', '1')
      .send(body)
      .expect(401);
    await request(app.getHttpServer())
      .post('/reportes')
      .set('Cookie', cookie)
      .send(body)
      .expect(403);
    await generate({ ...body, solicitud_id: 'invalido' }).expect(400);
    const [a, b] = await Promise.all([
      generate().expect(201),
      generate().expect(201),
    ]);
    expect(a.body).toEqual(b.body);
    const code = (a.body as { codigo_publico: string }).codigo_publico;
    const url = `/reportes/${code}/contenido`;
    const report = await get(url).expect(200);
    expect(report.headers['content-type']).toContain('text/html');
    expect(report.headers['cache-control']).toBe('no-store');
    expect(report.headers['content-security-policy']).toContain(
      "default-src 'none'",
    );
    expect(report.text).toContain('Valoración de prueba 21');
    expect(report.text).toContain('&lt;script&gt;');
    expect(report.text).not.toContain('<script>');
    expect(report.text).toContain('Edema registrado');
    await generate({ ...body, evaluacion: ulid() }).expect(409);
    await generate({
      ...body,
      solicitud_id: randomUUID(),
      evaluacion: ulid(),
    }).expect(404);
    await db.valoraciones_medicas.create({
      data: {
        codigo_publico: ulid(),
        orientacion_id: source.id,
        medico_id: id,
        solicitud_id: randomUUID(),
        decision: 'COINCIDE',
        valoracion: 'Valoración posterior al reporte generado.',
        acciones: 'Seguimiento posterior a la emisión del documento.',
      },
    });
    expect((await get(url).expect(200)).text).toBe(report.text);
    await get('/reportes').expect(200);
    await deny('reportes.generar');
    await get(url).expect(403);
    await generate().expect(403);
    await get('/reportes').expect(403);
    await db.usuario_permiso.deleteMany({ where: { usuario_id: id } });
    await deny('alertas.ver');
    await get(url).expect(403);
    await db.usuario_permiso.deleteMany({ where: { usuario_id: id } });
    await db.reportes_generados.update({
      where: { codigo_publico: code },
      data: { contenido_html: report.text + 'alterado' },
    });
    await get(url).expect(409);
  });

  it('guarda medición, autor y auditoría sin inventar indicadores', async () => {
    const body = await measurement();
    const response = await post(body).expect(201);
    const data = response.body as {
      codigo_publico: string;
      peso_kg: string;
      talla_cm: string;
    };
    expect(data.peso_kg).toBe('12.35');
    expect(data.talla_cm).toBe('85.25');
    expect(data).not.toHaveProperty('id');
    expect(data).not.toHaveProperty('registrado_por');
    const row = await db.evaluaciones_nutricionales.findUniqueOrThrow({
      where: { codigo_publico: data.codigo_publico },
    });
    expect(row.registrado_por).toBe(id);
    expect(row.estado).toBe('REGISTRADA');
    expect(row.imc?.toFixed(2)).toBe('16.99');
    expect(row.edad_dias).toBeGreaterThan(700);
    expect(
      await db.resultados_indicador.count({
        where: { evaluacion_id: row.id },
      }),
    ).toBe(0);
    expect(
      await db.registros_auditoria.count({
        where: {
          usuario_id: id,
          entidad: 'evaluaciones_nutricionales',
          entidad_id: row.id.toString(),
        },
      }),
    ).toBe(1);
  });
  it('reutiliza un envío idéntico incluso si llega concurrentemente', async () => {
    const body = await measurement();
    const results = await Promise.all([post(body), post(body)]);
    expect(results.map((r) => r.status)).toEqual([201, 201]);
    expect((results[0].body as { codigo_publico: string }).codigo_publico).toBe(
      (results[1].body as { codigo_publico: string }).codigo_publico,
    );
    expect(
      await db.evaluaciones_nutricionales.count({
        where: { ninos: { codigo_publico: body.nino_codigo } },
      }),
    ).toBe(1);
  });
  it('rechaza medidas fuera de rango, precisión extra y campos controlados por el servidor', async () => {
    const body = await measurement();
    for (const extra of [
      { peso_kg: 100, talla_cm: 30 },
      { peso_kg: 0 },
      { peso_kg: 100.01 },
      { peso_kg: 12.345 },
      { talla_cm: 29.99 },
      { talla_cm: 150.01 },
      { peso_kg: null },
      { peso_kg: '12' },
      { tipo_medicion: 'OTRO' },
      { estado: 'VALIDADA' },
      { edad_dias: 30 },
      { registrado_por: '1' },
      { imc: 20 },
    ])
      await post({ ...body, ...extra }).expect(400);
    expect(
      await db.evaluaciones_nutricionales.count({
        where: { ninos: { codigo_publico: body.nino_codigo } },
      }),
    ).toBe(0);
  });
  it('rechaza fechas futuras, imposibles, sin zona y anteriores al nacimiento', async () => {
    const body = await measurement();
    for (const evaluado_en of [
      new Date(Date.now() + 86400000).toISOString(),
      '2025-02-30T12:00:00Z',
      '2025-01-01T12:00:00',
      '2000-01-01T12:00:00Z',
    ])
      await post({ ...body, evaluado_en }).expect(400);
    await db.ninos.update({
      where: { codigo_publico: body.nino_codigo },
      data: { fecha_nacimiento: new Date('2000-01-01') },
    });
    await post(body).expect(400);
  });
  it('rechaza niño archivado, inexistente y centros no disponibles', async () => {
    const body = await measurement();
    await post({ ...body, nino_codigo: ulid() }).expect(404);
    await post({ ...body, centro_salud_id: '9223372036854775808' }).expect(400);
    await post({ ...body, centro_salud_id: (center + 1n).toString() }).expect(
      403,
    );
    await db.centros_salud.update({
      where: { id: center },
      data: { activo: false },
    });
    try {
      await post(body).expect(400);
    } finally {
      await db.centros_salud.update({
        where: { id: center },
        data: { activo: true },
      });
    }
    await db.ninos.update({
      where: { codigo_publico: body.nino_codigo },
      data: { estado: 'ARCHIVADO' },
    });
    await post(body).expect(409);
  });
  it('busca niños y consulta el centro asignado sin exponer certificados', async () => {
    const body = await measurement();
    const response = await get('/evaluaciones/ninos')
      .query({ busqueda: `Infantil${suffix}` })
      .expect(200);
    const rows = response.body as { codigo_publico: string }[];
    expect(rows.some((row) => row.codigo_publico === body.nino_codigo)).toBe(
      true,
    );
    for (const row of rows) {
      expect(row).not.toHaveProperty('certificado_hash');
      expect(row).not.toHaveProperty('certificado_cifrado');
      expect(row).not.toHaveProperty('id');
    }
    const centers = await get('/evaluaciones/centros').expect(200);
    expect(centers.body).toEqual([
      { id: center.toString(), nombre: `Centro de prueba ${suffix}` },
    ]);
    await get('/evaluaciones/ninos').query({ busqueda: 'ab' }).expect(400);
  });
  it('pagina el historial y filtra por niño sin exponer datos internos', async () => {
    const body = await measurement();
    await post(body).expect(201);
    const other = await measurement();
    await post(other).expect(201);
    const patients = await get('/evaluaciones/pacientes-historial')
      .query({ busqueda: 'Prueba' })
      .expect(200);
    expect(
      (patients.body as { codigo_publico: string }[]).some(
        (row) => row.codigo_publico === body.nino_codigo,
      ),
    ).toBe(true);
    const result = await get('/evaluaciones')
      .query({ nino_codigo: body.nino_codigo })
      .expect(200);
    const page = result.body as { total: number; datos: unknown[] };
    expect(page.total).toBe(1);
    expect(page.datos).toHaveLength(1);
    expect(
      (page.datos[0] as { ninos: { codigo_publico: string } }).ninos
        .codigo_publico,
    ).toBe(body.nino_codigo);
    expect(page.datos[0]).not.toHaveProperty('id');
    expect(result.headers['cache-control']).toBe('no-store');
    await get('/evaluaciones').query({ pagina: 0 }).expect(400);
  });
  it('separa permisos de captura, búsqueda e historial', async () => {
    const body = await measurement();
    await deny('evaluaciones.ver');
    await get('/evaluaciones').expect(403);
    await get('/evaluaciones/pacientes-historial')
      .query({ busqueda: 'Prueba' })
      .expect(403);
    await post(body).expect(201);
    await deny('ninos.buscar');
    await get('/evaluaciones/ninos').query({ busqueda: 'Prueba' }).expect(403);
    await deny('evaluaciones.crear');
    await post(body).expect(403);
    await get('/evaluaciones/centros').expect(403);
  });
  it('exige sesión en todos los endpoints', async () => {
    for (const path of [
      '/evaluaciones',
      '/evaluaciones/ninos?busqueda=Prueba',
      '/evaluaciones/pacientes-historial?busqueda=Prueba',
      '/evaluaciones/centros',
    ])
      await request(app.getHttpServer()).get(path).expect(401);
    await request(app.getHttpServer())
      .post('/evaluaciones')
      .set('X-NutriTech-Request', '1')
      .send({})
      .expect(401);
  });
  it('exige edema explícito y conserva las tres opciones sin confundirlas', async () => {
    const body = await measurement();
    const { edema, ...missing } = body;
    void edema;
    await post(missing).expect(400);
    for (const value of [null, 'INVALIDO', true])
      await post({ ...body, edema: value }).expect(400);
    for (const value of ['NO', 'SI', 'DESCONOCIDO']) {
      const response = await post({ ...body, edema: value }).expect(201);
      expect(response.body).toHaveProperty('edema', value);
    }
    expect(
      await db.evaluaciones_nutricionales.count({
        where: { ninos: { codigo_publico: body.nino_codigo } },
      }),
    ).toBe(3);
  });
  it('consulta los puntajes provisionales sin guardar resultados ni activar el patrón', async () => {
    const body = await measurement();
    const created = await post(body).expect(201);
    const code = (created.body as { codigo_publico: string }).codigo_publico;
    const response = await get(`/evaluaciones/${code}/calculo`).expect(200);
    const result = response.body as {
      provisional: boolean;
      indicadores: { P_E: { z: number | null }; T_E: { z: number | null } };
      codigo_publico: string;
    };
    expect(result.provisional).toBe(true);
    expect(response.body).toHaveProperty(
      'orientacion.version',
      'NUTRITECH-ORIENTACION-1',
    );
    expect(response.body).toHaveProperty('orientacion.persistida', false);
    expect(
      (response.body as { orientacion: { indicadores: unknown[] } }).orientacion
        .indicadores,
    ).toHaveLength(4);
    expect(result.codigo_publico).toBe(code);
    expect(result.indicadores.P_E.z).not.toBeNull();
    expect(result.indicadores.T_E.z).not.toBeNull();
    const z = result.indicadores.P_E.z!;
    expect(z).not.toBe(Number(z.toFixed(2)));
    expect(response.body).toHaveProperty(
      'version_motor',
      'nutritech-anthro-1.1.0-v2',
    );
    expect(response.headers['cache-control']).toBe('no-store');
    expect(result).not.toHaveProperty('id');
    expect(
      await db.resultados_indicador.count({
        where: { evaluaciones_nutricionales: { codigo_publico: code } },
      }),
    ).toBe(0);
    expect(
      (
        await db.evaluaciones_nutricionales.findUniqueOrThrow({
          where: { codigo_publico: code },
        })
      ).estado,
    ).toBe('REGISTRADA');
  });
  it('respeta edema presente y desconocido, incluido el valor predeterminado de registros previos', async () => {
    const body = await measurement();
    for (const value of ['SI', 'DESCONOCIDO']) {
      const response = await post({ ...body, edema: value }).expect(201);
      const code = (response.body as { codigo_publico: string }).codigo_publico;
      const preview = await get(`/evaluaciones/${code}/calculo`).expect(200);
      const result = preview.body as {
        indicadores: Record<
          string,
          { z: number | null; motivo: string | null }
        >;
      };
      for (const key of ['P_E', 'P_T', 'IMC_E']) {
        expect(result.indicadores[key].z).toBeNull();
        expect(result.indicadores[key].motivo).toBe(
          value === 'SI' ? 'EDEMA' : 'EDEMA_DESCONOCIDO',
        );
      }
      expect(result.indicadores.T_E.z).not.toBeNull();
    }
    const saved = await db.evaluaciones_nutricionales.findFirstOrThrow({
      where: { ninos: { codigo_publico: body.nino_codigo } },
    });
    const legacy = await db.evaluaciones_nutricionales.create({
      data: {
        codigo_publico: ulid(),
        nino_id: saved.nino_id,
        centro_salud_id: center,
        registrado_por: id,
        evaluado_en: new Date(),
        edad_dias: saved.edad_dias,
        peso_kg: 12,
        talla_cm: 85,
        tipo_medicion: 'TALLA_DE_PIE',
      },
    });
    expect(legacy.edema).toBe('DESCONOCIDO');
  });
  it('protege cálculo con permiso de consulta y rechaza códigos inválidos y evaluaciones anuladas', async () => {
    const body = await measurement();
    const created = await post(body).expect(201);
    const code = (created.body as { codigo_publico: string }).codigo_publico;
    await get('/evaluaciones/invalido/calculo').expect(400);
    await get(`/evaluaciones/${ulid()}/calculo`).expect(404);
    await request(app.getHttpServer())
      .get(`/evaluaciones/${code}/calculo`)
      .expect(401);
    await deny('evaluaciones.ver');
    await get(`/evaluaciones/${code}/calculo`).expect(403);
    await db.usuario_permiso.deleteMany({ where: { usuario_id: id } });
    await db.evaluaciones_nutricionales.update({
      where: { codigo_publico: code },
      data: {
        estado: 'ANULADA',
        anulada_por: id,
        anulada_en: new Date(),
        motivo_anulacion: 'Prueba temporal',
      },
    });
    await get(`/evaluaciones/${code}/calculo`).expect(409);
  });
  it('protege el dashboard y oculta conteos sin permiso de origen', async () => {
    await db.usuario_permiso.deleteMany({ where: { usuario_id: id } });
    await request(app.getHttpServer()).get('/dashboard').expect(401);
    const response = await get('/dashboard').expect(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body).toMatchObject({
      ninos_activos: await db.ninos.count({ where: { estado: 'ACTIVO' } }),
      evaluaciones_registradas: await db.evaluaciones_nutricionales.count({
        where: { estado: 'REGISTRADA' },
      }),
      orientaciones_sin_valoracion: await db.orientaciones_guardadas.count({
        where: {
          evaluacion: { estado: 'REGISTRADA' },
          valoraciones_medicas: { none: {} },
        },
      }),
      alertas_pendientes: await db.alertas.count({
        where: { estado: 'PENDIENTE' },
      }),
      alertas_en_revision: await db.alertas.count({
        where: { estado: 'EN_REVISION' },
      }),
    });
    await deny('alertas.ver');
    await deny('ninos.ver');
    await deny('evaluaciones.ver');
    const hidden = await get('/dashboard').expect(200);
    expect(hidden.body).toMatchObject({
      ninos_activos: null,
      evaluaciones_registradas: null,
      orientaciones_sin_valoracion: null,
      alertas_pendientes: null,
      alertas_en_revision: null,
    });
    await deny('dashboard.ver');
    await get('/dashboard').expect(403);
    await db.usuario_permiso.deleteMany({ where: { usuario_id: id } });
  });
  it('anula con motivo y auditoría, conserva la captura y rechaza repeticiones', async () => {
    await db.usuario_permiso.deleteMany({ where: { usuario_id: id } });
    const created = await post(await measurement()).expect(201);
    const code = (created.body as { codigo_publico: string }).codigo_publico;
    const url = `/evaluaciones/${code}/anular`;
    const annul = (motivo: string) =>
      request(app.getHttpServer())
        .post(url)
        .set('Cookie', cookie)
        .set('X-NutriTech-Request', '1')
        .send({ motivo });
    await request(app.getHttpServer())
      .post(url)
      .set('X-NutriTech-Request', '1')
      .send({ motivo: 'Captura incorrecta' })
      .expect(401);
    await request(app.getHttpServer())
      .post(url)
      .set('Cookie', cookie)
      .send({ motivo: 'Captura incorrecta' })
      .expect(403);
    await annul('     ').expect(400);
    await deny('evaluaciones.anular');
    await annul('Captura incorrecta').expect(403);
    await db.usuario_permiso.deleteMany({ where: { usuario_id: id } });
    const results = await Promise.all([
      annul('Peso ingresado incorrectamente'),
      annul('Peso ingresado incorrectamente'),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const row = await db.evaluaciones_nutricionales.findUniqueOrThrow({
      where: { codigo_publico: code },
    });
    expect(row.estado).toBe('ANULADA');
    expect(row.anulada_por).toBe(id);
    expect(row.motivo_anulacion).toBe('Peso ingresado incorrectamente');
    expect(
      await db.registros_auditoria.count({
        where: {
          entidad: 'evaluaciones_nutricionales',
          entidad_id: code,
          accion: 'ACTUALIZAR',
        },
      }),
    ).toBe(1);
    await get(`/evaluaciones/${code}/calculo`).expect(409);
  });
  it('permite al rol normal orientar y reportar solo sus propias evaluaciones', async () => {
    const created = await post(await measurement()).expect(201);
    const code = (created.body as { codigo_publico: string }).codigo_publico;
    const other = await db.usuarios.create({
      data: {
        codigo_publico: ulid(),
        codigo_acceso: `QA_OTHER_${suffix}`,
        nombres: 'Otro',
        apellidos: 'Ficticio',
        contrasena_hash: await hash(randomUUID(), 12),
      },
    });
    const admin = await db.roles.findUniqueOrThrow({
      where: { codigo: 'ADMINISTRADOR' },
    });
    const normal = await db.roles.findUniqueOrThrow({
      where: { codigo: 'USUARIO_NORMAL' },
    });
    let reportCode: string | undefined;
    const submit = (url: string, body = {}) =>
      request(app.getHttpServer())
        .post(url)
        .set('Cookie', cookie)
        .set('X-NutriTech-Request', '1')
        .send(body);
    try {
      await db.usuario_rol.deleteMany({ where: { usuario_id: id } });
      await db.usuario_rol.create({
        data: { usuario_id: id, rol_id: normal.id },
      });
      await get('/evaluaciones').expect(403);
      await get(`/evaluaciones/${code}/calculo`).expect(403);
      const path = `/mi-portal/evaluaciones/${code}/orientacion`;
      await request(app.getHttpServer())
        .post(path)
        .set('X-NutriTech-Request', '1')
        .expect(401);
      await request(app.getHttpServer())
        .post(path)
        .set('Cookie', cookie)
        .expect(403);
      const saved = await submit(path).expect(201);
      const orientation = (saved.body as { codigo_publico: string })
        .codigo_publico;
      expect(
        ((await submit(path).expect(201)).body as { codigo_publico: string })
          .codigo_publico,
      ).toBe(orientation);
      const body = {
        evaluacion: code,
        orientacion: orientation,
        solicitud_id: randomUUID(),
      };
      const report = await submit('/mi-portal/reportes', body).expect(201);
      reportCode = (report.body as { codigo_publico: string }).codigo_publico;
      await get(`/mi-portal/reportes/${reportCode}/contenido`)
        .expect(200)
        .expect('Content-Type', /html/);
      await db.evaluaciones_nutricionales.update({
        where: { codigo_publico: code },
        data: { registrado_por: other.id },
      });
      await submit(path).expect(404);
      await submit('/mi-portal/reportes', {
        ...body,
        solicitud_id: randomUUID(),
      }).expect(404);
      await get(`/mi-portal/reportes/${reportCode}/contenido`).expect(404);
      await db.evaluaciones_nutricionales.update({
        where: { codigo_publico: code },
        data: { registrado_por: id },
      });
      await db.reportes_generados.update({
        where: { codigo_publico: reportCode },
        data: { generado_por: other.id },
      });
      await get(`/mi-portal/reportes/${reportCode}/contenido`).expect(404);
      await db.reportes_generados.update({
        where: { codigo_publico: reportCode },
        data: { generado_por: id },
      });
      await deny('reportes.generar');
      await get(`/mi-portal/reportes/${reportCode}/contenido`).expect(403);
      await submit('/mi-portal/reportes', {
        ...body,
        solicitud_id: randomUUID(),
      }).expect(403);
    } finally {
      if (reportCode)
        await db.reportes_generados.update({
          where: { codigo_publico: reportCode },
          data: { generado_por: id },
        });
      await db.evaluaciones_nutricionales.update({
        where: { codigo_publico: code },
        data: { registrado_por: id },
      });
      await db.usuario_permiso.deleteMany({ where: { usuario_id: id } });
      await db.usuario_rol.deleteMany({ where: { usuario_id: id } });
      await db.usuario_rol.create({
        data: { usuario_id: id, rol_id: admin.id },
      });
      await db.usuarios.delete({ where: { id: other.id } });
    }
  });
  it('consulta sin expediente valida y calcula sin persistir datos clínicos', async () => {
    const admin = await db.roles.findUniqueOrThrow({
      where: { codigo: 'ADMINISTRADOR' },
    });
    const normal = await db.roles.findUniqueOrThrow({
      where: { codigo: 'USUARIO_NORMAL' },
    });
    const payload = {
      sexo: 'F',
      edad_dias: 730,
      peso_kg: 12,
      talla_cm: 85,
      tipo_medicion: 'TALLA_DE_PIE',
      edema: 'NO',
    };
    const submit = (body: object) =>
      request(app.getHttpServer())
        .post('/mi-portal/consulta')
        .set('Cookie', cookie)
        .set('X-NutriTech-Request', '1')
        .send(body);
    const counts = async () =>
      Promise.all([
        db.ninos.count(),
        db.evaluaciones_nutricionales.count(),
        db.orientaciones_guardadas.count(),
        db.alertas.count(),
        db.reportes_generados.count(),
      ]);
    try {
      await db.usuario_rol.deleteMany({ where: { usuario_id: id } });
      await db.usuario_rol.create({
        data: { usuario_id: id, rol_id: normal.id },
      });
      await deny('ninos.buscar');
      const before = await counts();
      await request(app.getHttpServer())
        .post('/mi-portal/consulta')
        .set('X-NutriTech-Request', '1')
        .send(payload)
        .expect(401);
      await request(app.getHttpServer())
        .post('/mi-portal/consulta')
        .set('Cookie', cookie)
        .send(payload)
        .expect(403);
      for (const invalid of [
        { edad_dias: -1 },
        { edad_dias: 1857 },
        { edad_dias: 1.5 },
        { sexo: 'X' },
        { peso_kg: 0 },
        { talla_cm: 10 },
        { edema: 'QUIZAS' },
      ])
        await submit({ ...payload, ...invalid }).expect(400);
      const result = await submit(payload).expect(201);
      expect(result.body).toHaveProperty('orientacion.persistida', false);
      expect(result.body).toHaveProperty('entrada.edad_dias', 730);
      expect(result.body).toHaveProperty('referencias_sha256');
      const indicators = (
        result.body as { orientacion: { indicadores: { z: number | null }[] } }
      ).orientacion.indicadores;
      expect(indicators).toHaveLength(4);
      expect(indicators.every((item) => item.z !== null)).toBe(true);
      for (const edema of ['SI', 'DESCONOCIDO']) {
        const special = await submit({ ...payload, edema }).expect(201);
        expect(
          (
            special.body as {
              orientacion: { indicadores: { estado: string }[] };
            }
          ).orientacion.indicadores.every(
            (item) => item.estado === 'REQUIERE_REVISION',
          ),
        ).toBe(true);
      }
      expect(await counts()).toEqual(before);
      await deny('evaluaciones.crear');
      await submit(payload).expect(403);
    } finally {
      await db.usuario_permiso.deleteMany({ where: { usuario_id: id } });
      await db.usuario_rol.deleteMany({ where: { usuario_id: id } });
      await db.usuario_rol.create({
        data: { usuario_id: id, rol_id: admin.id },
      });
    }
  });
  it('registra desde el portal con rol normal y completa medición y orientación', async () => {
    const admin = await db.roles.findUniqueOrThrow({
      where: { codigo: 'ADMINISTRADOR' },
    });
    const normal = await db.roles.findUniqueOrThrow({
      where: { codigo: 'USUARIO_NORMAL' },
    });
    const submit = (path: string, body: object) =>
      request(app.getHttpServer())
        .post(path)
        .set('Cookie', cookie)
        .set('X-NutriTech-Request', '1')
        .send(body);
    const data = child();
    try {
      await db.usuario_rol.deleteMany({ where: { usuario_id: id } });
      await db.usuario_rol.create({
        data: { usuario_id: id, rol_id: normal.id },
      });
      await get('/ninos').expect(403);
      await submit('/ninos', data).expect(403);
      await get('/mi-portal/ninos/comunidades').expect(200);
      await request(app.getHttpServer())
        .post('/mi-portal/ninos')
        .set('X-NutriTech-Request', '1')
        .send(data)
        .expect(401);
      await request(app.getHttpServer())
        .post('/mi-portal/ninos')
        .set('Cookie', cookie)
        .send(data)
        .expect(403);
      await submit('/mi-portal/ninos', { ...data, primer_nombre: '' }).expect(
        400,
      );
      const created = await submit('/mi-portal/ninos', data).expect(201);
      const childCode = (created.body as { codigo_publico: string })
        .codigo_publico;
      await submit('/mi-portal/ninos', data).expect(409);
      const measured = await submit('/evaluaciones', {
        nino_codigo: childCode,
        centro_salud_id: center.toString(),
        evaluado_en: '2026-01-01T12:00:00-06:00',
        peso_kg: 12,
        talla_cm: 85,
        tipo_medicion: 'TALLA_DE_PIE',
        edema: 'NO',
      }).expect(201);
      const evaluationCode = (measured.body as { codigo_publico: string })
        .codigo_publico;
      const saved = await submit(
        `/mi-portal/evaluaciones/${evaluationCode}/orientacion`,
        {},
      ).expect(201);
      expect(saved.body).toHaveProperty(
        'contenido.orientacion.persistida',
        true,
      );
      const row = await db.ninos.findUniqueOrThrow({
        where: { codigo_publico: childCode },
      });
      expect(row.registrado_por).toBe(id);
      await deny('ninos.buscar');
      await submit('/mi-portal/ninos', child()).expect(403);
    } finally {
      await db.usuario_permiso.deleteMany({ where: { usuario_id: id } });
      await db.usuario_rol.deleteMany({ where: { usuario_id: id } });
      await db.usuario_rol.create({
        data: { usuario_id: id, rol_id: admin.id },
      });
    }
  });
});

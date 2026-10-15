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
integration('Registro y listado de niños con MariaDB', () => {
  const db = new PrismaClient();
  const suffix = randomUUID().slice(0, 8);
  const code = `TEST_NINOS_${suffix}`;
  const password = randomUUID();
  let id: bigint;
  let community: bigint;
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

  it('registra, cifra el certificado y atribuye el registro a la sesión', async () => {
    const body = child();
    const response = await create({
      ...body,
      primer_nombre: '  Prueba  ',
      segundo_nombre: '',
      comunidad_id: community.toString(),
    }).expect(201);
    const data = response.body as {
      codigo_publico: string;
      codigo_expediente: string;
      certificado_ultimos4: string;
      primer_nombre: string;
    };
    expect(data.primer_nombre).toBe('Prueba');
    expect(data.codigo_expediente).toMatch(/^NT-[0-9A-Z]{26}$/);
    expect(data.certificado_ultimos4).toBe(
      body.certificado.toUpperCase().slice(-4),
    );
    for (const field of [
      'certificado',
      'certificado_hash',
      'certificado_cifrado',
      'id',
      'registrado_por',
    ])
      expect(data).not.toHaveProperty(field);
    const saved = await db.ninos.findUniqueOrThrow({
      where: { codigo_publico: data.codigo_publico },
    });
    expect(saved.registrado_por).toBe(id);
    expect(saved.certificado_hash.byteLength).toBe(32);
    expect(
      Buffer.from(saved.certificado_cifrado).includes(
        Buffer.from(body.certificado),
      ),
    ).toBe(false);
    const audit = await db.registros_auditoria.findFirstOrThrow({
      where: {
        usuario_id: id,
        entidad: 'ninos',
        entidad_id: saved.id.toString(),
      },
    });
    expect(audit.datos_nuevos).not.toContain(body.certificado);
  });

  it('rechaza duplicados aunque cambien espacios, guiones o mayúsculas', async () => {
    const body = child();
    await create(body).expect(201);
    await create({
      ...body,
      certificado: ` ${body.certificado.slice(0, 4).toLowerCase()}-${body.certificado.slice(4).toLowerCase()} `,
    }).expect(409);
  });

  it('resiste dos registros concurrentes del mismo certificado', async () => {
    const body = child();
    const results = await Promise.all([create(body), create(body)]);
    expect(results.map((result) => result.status).sort()).toEqual([201, 409]);
  });

  it('rechaza fechas imposibles y futuras', async () => {
    const future = new Date(Date.now() + 3 * 86400000)
      .toISOString()
      .slice(0, 10);
    for (const fecha_nacimiento of ['2025-02-29', future, '2024-02-30'])
      await create({ ...child(), fecha_nacimiento }).expect(400);
  });

  it('rechaza campos de autoría y estado enviados por el cliente', async () => {
    await create({
      ...child(),
      registrado_por: '1',
      estado: 'ARCHIVADO',
    }).expect(400);
    await create({
      ...child(),
      primer_nombre: ' ',
      sexo_biologico: 'X',
    }).expect(400);
  });

  it('valida la comunidad y permite omitirla', async () => {
    await create({ ...child(), comunidad_id: '18446744073709551616' }).expect(
      400,
    );
    await create({ ...child(), comunidad_id: '18446744073709551615' }).expect(
      400,
    );
    await create(child()).expect(201);
    const response = await request(app.getHttpServer())
      .get('/ninos/comunidades')
      .set('Cookie', cookie)
      .expect(200);
    expect(
      (response.body as { id: string }[]).some(
        (row) => row.id === community.toString(),
      ),
    ).toBe(true);
  });

  it('busca y pagina sin exponer certificados completos ni campos internos', async () => {
    await create(child()).expect(201);
    await create(child()).expect(201);
    const first = await request(app.getHttpServer())
      .get('/ninos')
      .query({ busqueda: `Infantil${suffix}`, limite: 1 })
      .set('Cookie', cookie)
      .expect(200);
    const second = await request(app.getHttpServer())
      .get('/ninos')
      .query({ busqueda: `Infantil${suffix}`, limite: 1, pagina: 2 })
      .set('Cookie', cookie)
      .expect(200);
    type Page = { total: number; datos: { codigo_publico: string }[] };
    const a = first.body as Page;
    const b = second.body as Page;
    expect(a.total).toBeGreaterThanOrEqual(2);
    expect(a.datos).toHaveLength(1);
    expect(a.datos[0].codigo_publico).not.toBe(b.datos[0].codigo_publico);
    for (const field of [
      'certificado_hash',
      'certificado_cifrado',
      'registrado_por',
      'direccion_referencia',
      'id',
    ])
      expect(a.datos[0]).not.toHaveProperty(field);
    expect(first.headers['cache-control']).toBe('no-store');
    await request(app.getHttpServer())
      .get('/ninos')
      .query({ pagina: 0, limite: 1000 })
      .set('Cookie', cookie)
      .expect(400);
  });

  it('exige permisos de consulta y creación independientemente', async () => {
    for (const codigo of ['ninos.ver', 'ninos.crear']) {
      const permission = await db.permisos.findUniqueOrThrow({
        where: { codigo },
      });
      await db.usuario_permiso.create({
        data: {
          usuario_id: id,
          permiso_id: permission.id,
          asignado_por: id,
          efecto: 'DENEGAR',
        },
      });
    }
    await request(app.getHttpServer())
      .get('/ninos')
      .set('Cookie', cookie)
      .expect(403);
    await create(child()).expect(403);
    await request(app.getHttpServer())
      .get('/ninos/comunidades')
      .set('Cookie', cookie)
      .expect(403);
  });

  it('rechaza consultas y registros sin sesión', async () => {
    await request(app.getHttpServer()).get('/ninos').expect(401);
    await request(app.getHttpServer())
      .post('/ninos')
      .set('X-NutriTech-Request', '1')
      .send(child())
      .expect(401);
  });
  function post(path: string, body: object = {}) {
    return request(app.getHttpServer())
      .post(path)
      .set('Cookie', cookie)
      .set('X-NutriTech-Request', '1')
      .send(body);
  }
  async function newChild() {
    const response = await create(child()).expect(201);
    return (response.body as { codigo_publico: string }).codigo_publico;
  }
  async function newGuardian(code: string, main = true) {
    const response = await post(`/ninos/${code}/responsables`, {
      responsable: {
        nombres: `Responsable${suffix}`,
        apellidos: 'Prueba',
        telefono: '55551234',
      },
      parentesco: 'TUTOR',
      es_principal: main,
      autorizado_contacto: false,
    }).expect(201);
    return (response.body as { responsable_codigo: string }).responsable_codigo;
  }

  it('consulta el detalle sin exponer certificado ni identificadores internos', async () => {
    const code = await newChild();
    const response = await request(app.getHttpServer())
      .get(`/ninos/${code}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(response.body).toHaveProperty('responsables', []);
    for (const field of ['id', 'certificado_hash', 'certificado_cifrado'])
      expect(response.body).not.toHaveProperty(field);
    await request(app.getHttpServer())
      .get('/ninos/no-valido')
      .set('Cookie', cookie)
      .expect(400);
    await request(app.getHttpServer())
      .get(`/ninos/${ulid()}`)
      .set('Cookie', cookie)
      .expect(404);
  });

  it('crea un responsable, lo encuentra y lo reutiliza para otro niño', async () => {
    const first = await newChild();
    const second = await newChild();
    const person = await newGuardian(first);
    const search = await request(app.getHttpServer())
      .get('/ninos/responsables/buscar')
      .query({ busqueda: `Responsable${suffix}` })
      .set('Cookie', cookie)
      .expect(200);
    expect(
      (search.body as { codigo_publico: string }[]).some(
        (item) => item.codigo_publico === person,
      ),
    ).toBe(true);
    const link = {
      responsable_codigo: person,
      parentesco: 'MADRE',
      es_principal: true,
      autorizado_contacto: true,
    };
    await post(`/ninos/${second}/responsables`, link).expect(201);
    await post(`/ninos/${second}/responsables`, link).expect(409);
    const detail = await request(app.getHttpServer())
      .get(`/ninos/${first}`)
      .set('Cookie', cookie)
      .expect(200);
    const rows = (
      detail.body as {
        responsables: {
          codigo_publico: string;
          autorizado_contacto: boolean;
        }[];
      }
    ).responsables;
    expect(rows).toHaveLength(1);
    expect(rows[0].codigo_publico).toBe(person);
    expect(rows[0].autorizado_contacto).toBe(false);
  });

  it('mantiene un único principal ante cambios simultáneos y registra auditoría', async () => {
    const code = await newChild();
    const one = await newGuardian(code);
    const two = await newGuardian(code, false);
    const results = await Promise.all([
      post(`/ninos/${code}/responsables/${one}/principal`),
      post(`/ninos/${code}/responsables/${two}/principal`),
    ]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(
      await db.nino_responsable.count({
        where: { ninos: { codigo_publico: code }, es_principal: true },
      }),
    ).toBe(1);
    expect(
      await db.registros_auditoria.count({
        where: {
          usuario_id: id,
          entidad: 'nino_responsable',
          accion: 'ACTUALIZAR',
        },
      }),
    ).toBeGreaterThan(0);
    await post(`/ninos/${code}/responsables/${ulid()}/principal`).expect(404);
  });

  it('rechaza vínculos inválidos sin crear personas huérfanas', async () => {
    const code = await newChild();
    const base = {
      parentesco: 'PADRE',
      es_principal: true,
      autorizado_contacto: true,
    };
    const count = await db.responsables.count({
      where: { nombres: `Responsable${suffix}` },
    });
    await post(`/ninos/${code}/responsables`, base).expect(400);
    await post(`/ninos/${code}/responsables`, {
      ...base,
      responsable: [],
    }).expect(400);
    await post(`/ninos/${code}/responsables`, {
      ...base,
      responsable: { nombres: `Responsable${suffix}`, apellidos: 'Prueba' },
      responsable_codigo: ulid(),
    }).expect(400);
    await db.ninos.update({
      where: { codigo_publico: code },
      data: { estado: 'ARCHIVADO' },
    });
    await post(`/ninos/${code}/responsables`, {
      ...base,
      responsable: { nombres: `Responsable${suffix}`, apellidos: 'Prueba' },
    }).expect(409);
    expect(
      await db.responsables.count({
        where: { nombres: `Responsable${suffix}` },
      }),
    ).toBe(count);
  });

  it('permite consultar, pero impide gestionar responsables si se deniega ninos.editar', async () => {
    const code = await newChild();
    const person = await newGuardian(code);
    const permission = await db.permisos.findUniqueOrThrow({
      where: { codigo: 'ninos.editar' },
    });
    await db.usuario_permiso.create({
      data: {
        usuario_id: id,
        permiso_id: permission.id,
        asignado_por: id,
        efecto: 'DENEGAR',
      },
    });
    await request(app.getHttpServer())
      .get(`/ninos/${code}`)
      .set('Cookie', cookie)
      .expect(200);
    await request(app.getHttpServer())
      .get('/ninos/responsables/buscar')
      .query({ busqueda: 'Prueba' })
      .set('Cookie', cookie)
      .expect(403);
    await post(`/ninos/${code}/responsables/${person}/principal`).expect(403);
    await post(`/ninos/${code}/responsables`, {
      responsable_codigo: person,
      parentesco: 'PADRE',
    }).expect(403);
  });
  it('edita con auditoría, evita sobrescrituras y permite reactivar un expediente', async () => {
    const created = await create(child()).expect(201);
    const code = (created.body as { codigo_publico: string }).codigo_publico;
    const detail = () =>
      request(app.getHttpServer()).get(`/ninos/${code}`).set('Cookie', cookie);
    const initial = await detail().expect(200);
    const before = await db.ninos.findUniqueOrThrow({
      where: { codigo_publico: code },
    });
    const body = {
      primer_nombre: 'Corregido',
      segundo_nombre: '',
      primer_apellido: 'Ensayo',
      segundo_apellido: '',
      direccion_referencia: 'Dirección ficticia',
      estado: 'ARCHIVADO',
      version_registro: (initial.body as { version_registro: number })
        .version_registro,
      motivo: 'Corrección de datos del ensayo',
    };
    const url = `/ninos/${code}/editar`;
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
    await post(url, { ...body, motivo: '     ' }).expect(400);
    await post(url, { ...body, fecha_nacimiento: '2020-01-01' }).expect(400);
    const permission = await db.permisos.findUniqueOrThrow({
      where: { codigo: 'ninos.editar' },
    });
    await db.usuario_permiso.create({
      data: {
        usuario_id: id,
        permiso_id: permission.id,
        asignado_por: id,
        efecto: 'DENEGAR',
      },
    });
    await post(url, body).expect(403);
    await db.usuario_permiso.deleteMany({ where: { usuario_id: id } });
    const results = await Promise.all([post(url, body), post(url, body)]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
    const saved = await db.ninos.findUniqueOrThrow({
      where: { codigo_publico: code },
    });
    expect(saved.primer_nombre).toBe('Corregido');
    expect(saved.estado).toBe('ARCHIVADO');
    expect(saved.archivado_en).not.toBeNull();
    expect(saved.version_registro).toBe(before.version_registro + 1);
    expect(saved.certificado_hash).toEqual(before.certificado_hash);
    expect(saved.fecha_nacimiento).toEqual(before.fecha_nacimiento);
    expect(saved.sexo_biologico).toBe(before.sexo_biologico);
    expect(
      await db.registros_auditoria.count({
        where: { entidad: 'ninos', entidad_id: code, accion: 'ACTUALIZAR' },
      }),
    ).toBe(1);
    await post(url, {
      ...body,
      estado: 'ACTIVO',
      version_registro: saved.version_registro,
    }).expect(201);
    const active = await db.ninos.findUniqueOrThrow({
      where: { codigo_publico: code },
    });
    expect(active.archivado_en).toBeNull();
    expect(active.estado).toBe('ACTIVO');
  });
  it('busca DPI exacto, evita duplicados y vincula al mismo padre a dos niños', async () => {
    const one = await newChild();
    const two = await newChild();
    const dpi =
      '9' +
      String(BigInt('0x' + randomUUID().replaceAll('-', '').slice(0, 10)))
        .padStart(12, '0')
        .slice(-12);
    const body = {
      responsable: {
        nombres: `Responsable${suffix}`,
        apellidos: 'Prueba DPI',
        dpi,
      },
      parentesco: 'PADRE',
      es_principal: true,
      autorizado_contacto: true,
    };
    await post(`/ninos/${one}/responsables`, {
      ...body,
      responsable: { ...body.responsable, dpi: '123' },
    }).expect(400);
    const linked = await post(`/ninos/${one}/responsables`, body).expect(201);
    const person = (linked.body as { responsable_codigo: string })
      .responsable_codigo;
    await post(`/ninos/${two}/responsables`, body).expect(409);
    const found = await post('/ninos/responsables/buscar', {
      busqueda: dpi,
    }).expect(201);
    expect(found.body).toEqual([
      expect.objectContaining({
        codigo_publico: person,
        dpi_ultimos4: dpi.slice(-4),
      }),
    ]);
    expect(JSON.stringify(found.body)).not.toContain(dpi);
    expect(JSON.stringify(found.body)).not.toContain('dpi_hash');
    const row = await db.responsables.findUniqueOrThrow({
      where: { codigo_publico: person },
    });
    expect(row.dpi_hash?.length).toBe(32);
    await post(`/ninos/${two}/responsables`, {
      responsable_codigo: person,
      parentesco: 'PADRE',
      es_principal: true,
      autorizado_contacto: true,
    }).expect(201);
    expect(
      await db.nino_responsable.count({ where: { responsable_id: row.id } }),
    ).toBe(2);
    const audit = await db.registros_auditoria.findMany({
      where: { usuario_id: id, entidad: 'nino_responsable' },
      select: { datos_nuevos: true },
    });
    expect(JSON.stringify(audit)).not.toContain(dpi);
    const admin = await db.roles.findUniqueOrThrow({
      where: { codigo: 'ADMINISTRADOR' },
    });
    const normal = await db.roles.findUniqueOrThrow({
      where: { codigo: 'USUARIO_NORMAL' },
    });
    try {
      await db.usuario_rol.deleteMany({ where: { usuario_id: id } });
      await db.usuario_rol.create({
        data: { usuario_id: id, rol_id: normal.id },
      });
      await post('/ninos/responsables/buscar', { busqueda: dpi }).expect(403);
      await post('/mi-portal/ninos/responsables/buscar', {
        busqueda: dpi,
      }).expect(201);
      await post(`/mi-portal/ninos/${ulid()}/responsables`, {
        responsable_codigo: person,
        parentesco: 'PADRE',
      }).expect(404);
      await post(`/mi-portal/ninos/${one}/responsables`, {
        responsable: {
          nombres: `Responsable${suffix}`,
          apellidos: 'Segunda persona',
        },
        parentesco: 'MADRE',
      }).expect(201);
    } finally {
      await db.usuario_rol.deleteMany({ where: { usuario_id: id } });
      await db.usuario_rol.create({
        data: { usuario_id: id, rol_id: admin.id },
      });
    }
  });
});

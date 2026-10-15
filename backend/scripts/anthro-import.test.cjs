const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { loadBundle, parseTable, run } = require('./anthro-import.cjs');
const lock = require('./anthro-lock.json');
const dir = path.resolve(__dirname, '../../database/references/anthro-1.1.0');
const spec = { ...lock.files[0], min: 0, max: 1 };
const sample =
  'sex\tage\tl\tm\ts\n1\t0\t0\t3.3464\t0.14602\n1\t1\t1\t3\t0.1\n2\t0\t1\t3\t0.1\n2\t1\t1\t3\t0.1\n';
test('verifica archivos oficiales, cantidades y coeficientes conocidos', () => {
  const bundle = loadBundle();
  assert.equal(bundle.rows.length, 13366);
  assert.deepEqual(
    bundle.tables.map((t) => t.rows.length),
    [3654, 3654, 3654, 1302, 1102],
  );
  assert.deepEqual(bundle.rows[0], {
    indicator: 'P_E',
    sexo_biologico: 'M',
    valor_l: '0.34870000',
    valor_m: '3.34640000',
    valor_s: '0.14602000',
    edad_dias: 0,
  });
});
test('rechaza archivo alterado aunque aún tenga formato válido', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'nutritech-lms-'));
  try {
    fs.cpSync(dir, temp, { recursive: true });
    fs.appendFileSync(path.join(temp, 'weianthro.txt'), '\n');
    assert.throws(() => loadBundle(temp), /SHA-256/);
  } finally {
    fs.rmSync(temp, { recursive: true, force: true });
  }
});
test('rechaza duplicados y huecos en la cobertura por sexo', () => {
  assert.throws(
    () => parseTable(sample + sample.split('\n')[1] + '\n', spec),
    /duplicada/,
  );
  assert.throws(
    () => parseTable(sample.replace('2\t1\t1\t3\t0.1\n', ''), spec),
    /Falta referencia/,
  );
});
test('rechaza números, sexo y precisión no compatibles sin redondearlos', () => {
  for (const bad of ['NaN', '1e3', '0.123456789'])
    assert.throws(
      () => parseTable(sample.replace('3.3464', bad), spec),
      /Decimal/,
    );
  assert.throws(
    () => parseTable(sample.replace('3.3464', '0'), spec),
    /positivos/,
  );
  assert.throws(() => parseTable(sample.replace('1\t0', '3\t0'), spec), /Sexo/);
  assert.equal(parseTable(sample, spec)[0].valor_l, '0.00000000');
});
test('rechaza método que contradice el eje de referencia', () => {
  const s = { ...spec, header: [...spec.header, 'loh'] };
  const text = sample
    .trim()
    .split('\n')
    .map((line, i) => line + (i === 0 ? '\tloh' : '\tH'))
    .join('\n');
  assert.throws(() => parseTable(text, s), /Método/);
});
test(
  'MariaDB: simulación, rollback, importación exacta, reintento y conflictos',
  { skip: process.env.RUN_DB_TESTS !== '1' },
  async () => {
    require('dotenv/config');
    const { PrismaClient } = require('@prisma/client');
    const db = new PrismaClient();
    let id;
    const code = 'TEST_IMPORT_' + randomUUID().slice(0, 8);
    try {
      id = (
        await db.patrones_crecimiento.create({
          data: {
            codigo: code,
            nombre: code,
            version: 'TEST',
            organizacion_fuente: 'Prueba técnica temporal',
            activo: false,
          },
        })
      ).id;
      const dry = await run(db, { code });
      assert.equal(dry.estado, 'LISTO_PARA_IMPORTAR');
      assert.equal(
        await db.parametros_lms_edad.count({ where: { patron_id: id } }),
        0,
      );
      const failing = {
        $transaction: (fn, opts) =>
          db.$transaction(
            (tx) =>
              fn(
                new Proxy(tx, {
                  get(target, key) {
                    if (key === 'registros_auditoria')
                      return {
                        create: () => {
                          throw Error('Fallo simulado de auditoría');
                        },
                      };
                    return target[key];
                  },
                }),
              ),
            opts,
          ),
      };
      await assert.rejects(
        run(failing, { apply: true, code }),
        /Fallo simulado/,
      );
      assert.equal(
        await db.parametros_lms_edad.count({ where: { patron_id: id } }),
        0,
      );
      assert.equal(
        await db.parametros_lms_talla.count({ where: { patron_id: id } }),
        0,
      );
      assert.equal((await run(db, { apply: true, code })).estado, 'IMPORTADO');
      assert.equal(
        (await run(db, { apply: true, code })).estado,
        'YA_COINCIDE',
      );
      assert.equal(
        await db.registros_auditoria.count({
          where: { entidad: 'patrones_crecimiento', entidad_id: String(id) },
        }),
        1,
      );
      assert.equal(
        (await db.patrones_crecimiento.findUniqueOrThrow({ where: { id } }))
          .activo,
        false,
      );
      await db.patrones_crecimiento.update({
        where: { id },
        data: { activo: true },
      });
      await assert.rejects(run(db, { apply: true, code }), /inactivo/);
      await db.patrones_crecimiento.update({
        where: { id },
        data: { activo: false },
      });
      const row = await db.parametros_lms_edad.findFirstOrThrow({
        where: { patron_id: id },
      });
      await db.parametros_lms_edad.update({
        where: { id: row.id },
        data: { valor_m: 999 },
      });
      await assert.rejects(
        run(db, { apply: true, code }),
        /parcial o diferente/,
      );
      assert.equal(
        (
          await db.parametros_lms_edad.findUniqueOrThrow({
            where: { id: row.id },
          })
        ).valor_m.toString(),
        '999',
      );
    } finally {
      if (id)
        await db.$transaction(async (tx) => {
          await tx.parametros_lms_edad.deleteMany({ where: { patron_id: id } });
          await tx.parametros_lms_talla.deleteMany({
            where: { patron_id: id },
          });
          await tx.registros_auditoria.deleteMany({
            where: { entidad: 'patrones_crecimiento', entidad_id: String(id) },
          });
          await tx.patrones_crecimiento.delete({ where: { id } });
        });
      await db.$disconnect();
    }
  },
);

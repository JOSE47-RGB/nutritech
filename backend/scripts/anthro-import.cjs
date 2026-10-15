const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const lock = require('./anthro-lock.json');
const referenceDir = path.resolve(
  __dirname,
  '../../database/references/anthro-1.1.0',
);
function ensure(condition, message) {
  if (!condition) throw new Error(message);
}
function decimal(value) {
  ensure(
    /^-?\d{1,6}(\.\d{1,8})?$/.test(value),
    `Decimal inválido o precisión incompatible: ${value}`,
  );
  const [integer, fraction = ''] = value.split('.');
  return `${integer}.${fraction.padEnd(8, '0')}`;
}
function parseTable(text, spec) {
  const lines = text.replace(/\r\n/g, '\n').trimEnd().split('\n');
  ensure(
    lines.shift() === spec.header.join('\t'),
    `${spec.file}: encabezado inesperado`,
  );
  const keys = new Set();
  const rows = lines.map((line, index) => {
    const cells = line.split('\t');
    ensure(
      cells.length === spec.header.length,
      `${spec.file}:${index + 2}: columnas inválidas`,
    );
    const row = Object.fromEntries(
      spec.header.map((key, i) => [key, cells[i]]),
    );
    ensure(row.sex === '1' || row.sex === '2', 'Sexo de referencia inválido');
    ensure(
      spec.axis === 'age'
        ? /^\d+$/.test(row.age)
        : /^\d+(\.\d)?$/.test(row[spec.axis]),
      'Eje de referencia inválido',
    );
    const position = Number(row[spec.axis]) * (spec.axis === 'age' ? 1 : 10);
    ensure(
      Number.isInteger(position) &&
        position >= spec.min &&
        position <= spec.max,
      'Referencia fuera de cobertura',
    );
    const key = `${row.sex}:${position}`;
    ensure(!keys.has(key), `Clave duplicada: ${key}`);
    keys.add(key);
    if (row.loh)
      ensure(
        row.loh === (position < 731 ? 'L' : 'H'),
        'Método por edad incompatible',
      );
    if (row.lorh)
      ensure(
        row.lorh === (spec.axis === 'length' ? 'L' : 'H'),
        'Método de talla incompatible',
      );
    const values = {
      valor_l: decimal(row.l),
      valor_m: decimal(row.m),
      valor_s: decimal(row.s),
    };
    ensure(Number(row.m) > 0 && Number(row.s) > 0, 'M y S deben ser positivos');
    return {
      indicator: spec.indicator,
      sexo_biologico: row.sex === '1' ? 'M' : 'F',
      ...values,
      ...(spec.axis === 'age'
        ? { edad_dias: position }
        : { talla_cm: (position / 10).toFixed(1), tipo_medicion: spec.method }),
    };
  });
  for (const sex of ['1', '2'])
    for (let n = spec.min; n <= spec.max; n++)
      ensure(keys.has(`${sex}:${n}`), `Falta referencia ${sex}:${n}`);
  ensure(
    rows.length === (spec.max - spec.min + 1) * 2,
    'Cantidad de referencias inesperada',
  );
  return rows;
}
function loadBundle(directory = referenceDir) {
  const tables = lock.files.map((spec) => {
    const bytes = fs.readFileSync(path.join(directory, spec.file));
    ensure(
      createHash('sha256').update(bytes).digest('hex') === spec.sha256,
      `SHA-256 no coincide: ${spec.file}`,
    );
    return { spec, rows: parseTable(bytes.toString('utf8'), spec) };
  });
  return { tables, rows: tables.flatMap((t) => t.rows), commit: lock.commit };
}
const fields = {
  indicador_id: true,
  sexo_biologico: true,
  valor_l: true,
  valor_m: true,
  valor_s: true,
};
function canonical(row) {
  return [
    row.indicador_id,
    row.sexo_biologico,
    row.edad_dias ?? `${row.tipo_medicion}:${Number(row.talla_cm).toFixed(1)}`,
    ...['valor_l', 'valor_m', 'valor_s'].map((k) => decimal(row[k].toString())),
  ].join('|');
}
async function databasePlan(tx, bundle, code) {
  const pattern = await tx.patrones_crecimiento.findUnique({
    where: { codigo: code },
  });
  ensure(pattern, 'No existe el patrón de destino');
  ensure(
    !pattern.activo,
    'El patrón debe permanecer inactivo durante esta preparación',
  );
  ensure(
    (await tx.resultados_indicador.count({
      where: { patron_id: pattern.id },
    })) === 0,
    'El patrón ya tiene resultados asociados',
  );
  const indicators = await tx.tipos_indicador.findMany({
    where: { codigo: { in: ['P_E', 'T_E', 'IMC_E', 'P_T'] } },
  });
  const config = {
    P_E: ['EDAD_DIAS', 'PESO_KG'],
    T_E: ['EDAD_DIAS', 'TALLA_CM'],
    IMC_E: ['EDAD_DIAS', 'IMC'],
    P_T: ['TALLA_CM', 'PESO_KG'],
  };
  ensure(indicators.length === 4, 'Faltan indicadores requeridos');
  for (const item of indicators)
    ensure(
      item.activo &&
        item.eje_referencia === config[item.codigo][0] &&
        item.variable_resultado === config[item.codigo][1],
      `Indicador incompatible: ${item.codigo}`,
    );
  const ids = Object.fromEntries(indicators.map((i) => [i.codigo, i.id]));
  const target = bundle.rows.map(({ indicator, ...row }) => ({
    ...row,
    indicador_id: ids[indicator],
    patron_id: pattern.id,
  }));
  const ages = target.filter((row) => row.edad_dias !== undefined);
  const heights = target.filter((row) => row.talla_cm !== undefined);
  const existingAge = await tx.parametros_lms_edad.findMany({
    where: { patron_id: pattern.id },
    select: { ...fields, edad_dias: true },
  });
  const existingHeight = await tx.parametros_lms_talla.findMany({
    where: { patron_id: pattern.id },
    select: { ...fields, talla_cm: true, tipo_medicion: true },
  });
  const existing = [...existingAge, ...existingHeight];
  const expected = new Set(target.map(canonical));
  const identical =
    existing.length === target.length &&
    existing.every((row) => expected.has(canonical(row)));
  ensure(
    existing.length === 0 || identical,
    'Carga parcial o diferente detectada: no se sobrescribirá ningún parámetro',
  );
  return { pattern, ages, heights, identical };
}
async function run(
  db,
  { apply = false, code = 'OMS-2006', directory = referenceDir } = {},
) {
  // Verificamos los archivos en cada ejecución, también antes de un reintento.
  const bundle = loadBundle(directory);
  return db.$transaction(
    async (tx) => {
      if (apply)
        await tx.$queryRaw`SELECT id FROM patrones_crecimiento WHERE codigo = ${code} FOR UPDATE`;
      const plan = await databasePlan(tx, bundle, code);
      if (apply && !plan.identical) {
        const now = new Date();
        for (const [model, rows] of [
          ['parametros_lms_edad', plan.ages],
          ['parametros_lms_talla', plan.heights],
        ]) {
          for (let i = 0; i < rows.length; i += 500)
            await tx[model].createMany({
              data: rows
                .slice(i, i + 500)
                .map((row) => ({ ...row, creado_en: now })),
            });
        }
        // Comparación de todas las claves y coeficientes leídos de MariaDB.
        ensure(
          (await databasePlan(tx, bundle, code)).identical,
          'La lectura posterior no coincide; se revierte la importación',
        );
        await tx.registros_auditoria.create({
          data: {
            accion: 'INSERTAR',
            entidad: 'patrones_crecimiento',
            entidad_id: String(plan.pattern.id),
            ocurrido_en: now,
            datos_nuevos: JSON.stringify({
              operacion: 'IMPORTAR_LMS',
              commit: bundle.commit,
              archivos: lock.files.map(({ file, sha256 }) => ({
                file,
                sha256,
              })),
              edad: plan.ages.length,
              talla: plan.heights.length,
            }),
          },
        });
      }
      return {
        modo: apply ? 'aplicar' : 'simulacion',
        patron: code,
        estado: plan.identical
          ? 'YA_COINCIDE'
          : apply
            ? 'IMPORTADO'
            : 'LISTO_PARA_IMPORTAR',
        commit: bundle.commit,
        parametros_edad: plan.ages.length,
        parametros_talla: plan.heights.length,
        patron_activo: false,
        tablas: bundle.tables.map(({ spec, rows }) => ({
          archivo: spec.file,
          indicador: spec.indicator,
          filas: rows.length,
          sha256: spec.sha256,
        })),
      };
    },
    { timeout: 120000, maxWait: 10000 },
  );
}
module.exports = { loadBundle, parseTable, decimal, run };
if (require.main === module) {
  require('dotenv/config');
  const { PrismaClient } = require('@prisma/client');
  const args = process.argv.slice(2);
  if (
    args.some((arg) => !['--apply', '--files-only'].includes(arg)) ||
    (args.includes('--apply') && args.includes('--files-only'))
  ) {
    console.error(
      'Uso: node scripts/anthro-import.cjs [--files-only | --apply]',
    );
    process.exitCode = 1;
  } else if (args.includes('--files-only')) {
    try {
      const bundle = loadBundle();
      console.log(
        JSON.stringify(
          {
            estado: 'ARCHIVOS_VERIFICADOS',
            commit: bundle.commit,
            filas: bundle.rows.length,
          },
          null,
          2,
        ),
      );
    } catch (e) {
      console.error(e.message);
      process.exitCode = 1;
    }
  } else {
    const db = new PrismaClient();
    run(db, { apply: args.includes('--apply') })
      .then((report) => console.log(JSON.stringify(report, null, 2)))
      .catch((e) => {
        console.error(e.message);
        process.exitCode = 1;
      })
      .finally(() => db.$disconnect());
  }
}

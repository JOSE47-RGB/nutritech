import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  NutritionCalculator,
  type Reference,
} from '../src/nutrition/calculator';
import { compareOracle, loadOracle } from '../src/nutrition/oracle';
const { loadBundle } = createRequire(__filename)('./anthro-import.cjs') as {
  loadBundle: () => { rows: Reference[]; commit: string };
};
const db = new PrismaClient();
function fingerprint(rows: Reference[]) {
  return createHash('sha256')
    .update(
      rows
        .map((row) =>
          [
            row.indicator,
            row.sexo_biologico,
            row.edad_dias ??
              `${row.tipo_medicion}:${Number(row.talla_cm).toFixed(1)}`,
            ...[row.valor_l, row.valor_m, row.valor_s].map((value) =>
              Number(value).toFixed(8),
            ),
          ].join('|'),
        )
        .sort()
        .join('\n'),
    )
    .digest('hex');
}
async function main() {
  const official = loadBundle();
  const oracle = loadOracle();
  if (official.commit !== oracle.commit)
    throw Error('Versiones de referencia y casos incompatibles');
  const [pattern, age, height] = await db.$transaction([
    db.patrones_crecimiento.findUniqueOrThrow({
      where: { codigo: 'OMS-2006' },
      select: { activo: true },
    }),
    db.parametros_lms_edad.findMany({
      where: { patrones_crecimiento: { codigo: 'OMS-2006' } },
      select: {
        sexo_biologico: true,
        edad_dias: true,
        valor_l: true,
        valor_m: true,
        valor_s: true,
        tipos_indicador: { select: { codigo: true } },
      },
    }),
    db.parametros_lms_talla.findMany({
      where: { patrones_crecimiento: { codigo: 'OMS-2006' } },
      select: {
        sexo_biologico: true,
        talla_cm: true,
        tipo_medicion: true,
        valor_l: true,
        valor_m: true,
        valor_s: true,
        tipos_indicador: { select: { codigo: true } },
      },
    }),
  ]);
  const rows: Reference[] = [
    ...age.map((row) => ({
      indicator: row.tipos_indicador.codigo as Reference['indicator'],
      sexo_biologico: row.sexo_biologico,
      edad_dias: row.edad_dias,
      valor_l: row.valor_l.toFixed(8),
      valor_m: row.valor_m.toFixed(8),
      valor_s: row.valor_s.toFixed(8),
    })),
    ...height.map((row) => ({
      indicator: row.tipos_indicador.codigo as Reference['indicator'],
      sexo_biologico: row.sexo_biologico,
      talla_cm: row.talla_cm.toFixed(1),
      tipo_medicion: row.tipo_medicion,
      valor_l: row.valor_l.toFixed(8),
      valor_m: row.valor_m.toFixed(8),
      valor_s: row.valor_s.toFixed(8),
    })),
  ];
  if (
    rows.length !== official.rows.length ||
    fingerprint(rows) !== fingerprint(official.rows)
  )
    throw Error(
      'Los parámetros de MariaDB no coinciden íntegramente con la referencia verificada',
    );
  const failures = compareOracle(new NutritionCalculator(rows), oracle.cases);
  const report = {
    verificado_en: new Date().toISOString(),
    commit: official.commit,
    runtime_referencia: oracle.runtime,
    referencias_comparadas: rows.length,
    casos: oracle.cases.length,
    indicadores_por_caso: 4,
    discrepancias: failures,
    patron_activo: pattern.activo,
    persistencia_resultados: false,
  };
  writeFileSync(
    resolve(
      __dirname,
      '../../database/references/anthro-1.1.0/calculation-verification.json',
    ),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) process.exitCode = 1;
}
void main()
  .catch((error: unknown) => {
    console.error(
      error instanceof Error ? error.message : 'Falló la verificación',
    );
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());

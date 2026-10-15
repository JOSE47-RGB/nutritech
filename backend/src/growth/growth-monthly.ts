import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Method, Sex } from '../nutrition/calculator';

export interface MonthlyReference {
  sexo: Sex;
  meses: number;
  peso_kg: number;
  talla_cm: number;
  tipo_medicion: Method;
}
const directory = resolve(
  __dirname,
  '../../../database/references/growth-monthly',
);
export function monthlyReferences(sex: Sex) {
  const manifest = JSON.parse(
    readFileSync(resolve(directory, 'manifest.json'), 'utf8'),
  ) as {
    version: string;
    sha256: string;
    fuentes: { archivo: string; url: string; sha256: string }[];
  };
  const bytes = readFileSync(resolve(directory, 'medians.json'));
  const digest = (value: Buffer) =>
    createHash('sha256').update(value).digest('hex');
  if (digest(bytes) !== manifest.sha256 || manifest.fuentes.length !== 6)
    throw new Error('Tabla mensual no verificada');
  for (const source of manifest.fuentes)
    if (
      digest(readFileSync(resolve(directory, source.archivo))) !== source.sha256
    )
      throw new Error('Fuente mensual no verificada');
  const rows = JSON.parse(bytes.toString('utf8')) as MonthlyReference[];
  if (rows.length !== 122) throw new Error('Cobertura mensual incompleta');
  const selected = rows.filter((row) => row.sexo === sex);
  for (let month = 0; month <= 60; month++) {
    const matching = selected.filter((row) => row.meses === month);
    const row = matching[0];
    if (
      matching.length !== 1 ||
      !row ||
      !Number.isFinite(row.peso_kg) ||
      row.peso_kg <= 0 ||
      !Number.isFinite(row.talla_cm) ||
      row.talla_cm <= 0 ||
      row.tipo_medicion !== (month < 24 ? 'LONGITUD_ACOSTADO' : 'TALLA_DE_PIE')
    )
      throw new Error('Fila mensual inválida');
  }
  return {
    sexo: sex,
    filas: selected,
    version: manifest.version,
    sha256: manifest.sha256,
    fuentes: manifest.fuentes.map(({ url }) => url),
  };
}

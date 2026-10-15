require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const fs = require('node:fs');
const path = require('node:path');
const db = new PrismaClient();
(async () => {
  const columns = await db.$queryRaw`SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='evaluaciones_nutricionales' AND COLUMN_NAME='edema'`;
  if (columns.length && (columns[0].COLUMN_TYPE !== "enum('SI','NO','DESCONOCIDO')" || columns[0].IS_NULLABLE !== 'NO' || String(columns[0].COLUMN_DEFAULT).replaceAll("'",'') !== 'DESCONOCIDO')) throw Error('La columna edema existente tiene otra definición; no se modificó.');
  if (!columns.length) await db.$executeRawUnsafe(fs.readFileSync(path.resolve(__dirname,'../../database/migrations/002-evaluaciones-edema.sql'),'utf8'));
  console.log(columns.length ? 'Edema: migración ya aplicada.' : 'Edema: columna agregada; registros previos quedan DESCONOCIDO.');
})().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(()=>db.$disconnect());

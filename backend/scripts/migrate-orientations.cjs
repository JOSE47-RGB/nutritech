require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const db = new PrismaClient();
(async () => {
  await db.$executeRawUnsafe(readFileSync(resolve(__dirname, '../../database/migrations/003-orientaciones-guardadas.sql'), 'utf8'));
  console.log('Tabla de orientaciones guardadas disponible. No se modificaron evaluaciones existentes.');
})().catch(e => { console.error('No se completó la migración:', e.code || e.name); process.exitCode = 1; }).finally(() => db.$disconnect());

require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.$connect();
  const rows = await prisma.$queryRaw`
    SELECT COUNT(*) AS total
    FROM information_schema.tables
    WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
  `;
  console.log(`Conexión correcta con MariaDB. Tablas accesibles: ${rows[0].total}.`);
}

main()
  .catch((error) => {
    console.error('No se pudo verificar la base de datos. Código:', error.errorCode || error.code || 'DESCONOCIDO');
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());

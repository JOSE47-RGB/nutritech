require('dotenv/config');
const {PrismaClient}=require('@prisma/client');
const fs=require('node:fs');const path=require('node:path');const db=new PrismaClient();
db.$executeRawUnsafe(fs.readFileSync(path.resolve(__dirname,'../../database/migrations/007-responsables-dpi.sql'),'utf8')).then(()=>console.log('DPI de responsables: migración aplicada.')).catch(()=>{console.error('No se pudo aplicar la migración de DPI.');process.exitCode=1}).finally(()=>db.$disconnect());

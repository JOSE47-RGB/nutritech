require('dotenv').config({quiet:true});
const {PrismaClient}=require('@prisma/client');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const db=new PrismaClient();
(async()=>{
 const columns=await db.$queryRaw`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='reportes_generados' AND COLUMN_NAME IN ('orientacion_id','solicitud_id','contenido_html')`;
 if(columns.length && columns.length!==3) throw Error('Migración parcial; revisar antes de continuar.');
 if(!columns.length) await db.$executeRawUnsafe(readFileSync(resolve(__dirname,'../../database/migrations/006-reportes-imprimibles.sql'),'utf8'));
 console.log('Reportes imprimibles disponibles. Registros previos conservados.');
})().catch(e=>{console.error('Migración no completada:',e.code||e.message);process.exitCode=1;}).finally(()=>db.$disconnect());

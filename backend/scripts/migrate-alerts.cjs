require('dotenv').config({quiet:true});
const {PrismaClient}=require('@prisma/client');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const db=new PrismaClient();
(async()=>{
 const columns=await db.$queryRaw`SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='alertas' AND COLUMN_NAME IN ('orientacion_id','tipo_aviso','regla_aviso','version_politica','revision')`;
 if(columns.length && columns.length!==5) throw Error('Migración parcial; revisar antes de continuar.');
 if(!columns.length) await db.$executeRawUnsafe(readFileSync(resolve(__dirname,'../../database/migrations/005-alertas-orientacion.sql'),'utf8'));
 console.log('Alertas vinculadas a orientaciones disponibles; alertas anteriores conservadas.');
})().catch(e=>{console.error('Migración no completada:',e.code||e.message);process.exitCode=1;}).finally(()=>db.$disconnect());

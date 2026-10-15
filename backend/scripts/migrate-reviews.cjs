require('dotenv').config({quiet:true});
const {PrismaClient}=require('@prisma/client');
const {readFileSync}=require('node:fs');
const {resolve}=require('node:path');
const db=new PrismaClient();
(async()=>{
 const statements=readFileSync(resolve(__dirname,'../../database/migrations/004-valoraciones-medicas.sql'),'utf8').split(';').map(s=>s.trim()).filter(Boolean);
 for(const sql of statements) await db.$executeRawUnsafe(sql);
 console.log('Valoraciones disponibles; permiso asignado al rol MEDICO.');
})().catch(e=>{console.error('Migración no completada:',e.code||e.name);process.exitCode=1;}).finally(()=>db.$disconnect());

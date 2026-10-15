require('dotenv').config({path:require('node:path').resolve(__dirname,'../.env'),quiet:true});
const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();
(async()=>{await db.$transaction(async tx=>{
 const role=await tx.roles.findUniqueOrThrow({where:{codigo:'ADMINISTRADOR'}});
 const permission=await tx.permisos.upsert({where:{codigo:'comunidades.gestionar'},update:{},create:{codigo:'comunidades.gestionar',modulo:'catalogos',descripcion:'Consultar, crear y editar comunidades'}});
 await tx.rol_permiso.upsert({where:{rol_id_permiso_id:{rol_id:role.id,permiso_id:permission.id}},update:{},create:{rol_id:role.id,permiso_id:permission.id}});
});console.log('Módulo de comunidades habilitado para administración.');})().catch(e=>{console.error(e.code||e.message);process.exitCode=1}).finally(()=>db.$disconnect());

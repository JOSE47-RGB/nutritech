// Restauración de ensayo: siempre crea y elimina una base con nombre aleatorio.
require('dotenv').config({quiet:true});
const {PrismaClient}=require('@prisma/client');const {verifyFile,key}=require('./backup.cjs');
const {randomBytes,createDecipheriv}=require('node:crypto');const fs=require('node:fs');const fsp=require('node:fs/promises');const path=require('node:path');const os=require('node:os');const {spawn}=require('node:child_process');const {pipeline}=require('node:stream/promises');const readline=require('node:readline');
const db=new PrismaClient();
async function main(){
 const id=process.argv[2];if(!/^[1-9][0-9]*$/.test(id||''))throw new Error('Indica el ID del respaldo.');
 const source=new URL(process.env.DATABASE_URL),name=decodeURIComponent(source.pathname.slice(1));
 if(!/^[a-zA-Z0-9_]+$/.test(name))throw new Error('Nombre de base no compatible con la prueba.');
 const file=path.resolve(process.env.BACKUP_DIR||'../database/backups',`nutritech-${id}.ntb`);
 await verifyFile(file);
 const target='nutritech_restore_'+randomBytes(8).toString('hex');
 const tmp=await fsp.mkdtemp(path.join(os.tmpdir(),'nutritech-restore-'));let created=false,child;
 try {
  const size=(await fsp.stat(file)).size,head=Buffer.alloc(16),tag=Buffer.alloc(16),handle=await fsp.open(file,'r');
  try{await handle.read(head,0,16,0);await handle.read(tag,0,16,size-16)}finally{await handle.close()}
  const decipher=createDecipheriv('aes-256-gcm',key(),head.subarray(4));decipher.setAuthTag(tag);
  const plain=path.join(tmp,'dump.sql');
  await pipeline(fs.createReadStream(file,{start:16,end:size-17}),decipher,fs.createWriteStream(plain,{flags:'wx',mode:0o600}));
  const normalized=path.join(tmp,'restore.sql');const out=fs.createWriteStream(normalized,{flags:'wx',mode:0o600});
  const {once}=require('node:events');
  // Solo se adapta SQL generado de vistas; los INSERT con datos no se reescriben.
  const input=readline.createInterface({input:fs.createReadStream(plain),crlfDelay:Infinity});
  for await(let line of input){
   if(/^(CREATE DATABASE|USE )/i.test(line))throw new Error('El dump selecciona una base: no se importará.');
   if(/^\/\*!50013 DEFINER=/.test(line)) line='/*!50013 SQL SECURITY INVOKER */';
   if(/^\/\*!50001 VIEW /.test(line))line=line.replaceAll('`'+name+'`.','`'+target+'`.');
   if(!out.write(line+'\n'))await once(out,'drain');
  }
  out.end();await once(out,'finish');
  const quote=v=>'"'+v.replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('\n','\\n').replaceAll('\r','\\r')+'"';
  const config=path.join(tmp,'client.cnf');await fsp.writeFile(config,`[client]\nhost=${quote(source.hostname)}\nport=${source.port||3306}\nuser=${quote(decodeURIComponent(source.username))}\npassword=${quote(decodeURIComponent(source.password))}\n`,{mode:0o600});
  await db.$executeRawUnsafe(`CREATE DATABASE \`${target}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);created=true;
  child=spawn('mariadb',[`--defaults-extra-file=${config}`,target],{stdio:['pipe','ignore','ignore']});
  const completed=new Promise((resolve,reject)=>{child.once('error',()=>reject(new Error('Cliente MariaDB no disponible.')));child.once('close',code=>code===0?resolve():reject(new Error('Falló la importación temporal.')))});
  const timer=setTimeout(()=>child.kill('SIGTERM'),110000);try{await Promise.all([pipeline(fs.createReadStream(normalized),child.stdin),completed])}finally{clearTimeout(timer)}
  const tables=await db.$queryRawUnsafe('SELECT COUNT(*) AS total FROM information_schema.tables WHERE table_schema=? AND table_type=\'BASE TABLE\'',target);
  if(Number(tables[0].total)<29)throw new Error('La restauración no contiene las tablas esperadas.');
  for(const table of ['usuarios','ninos','evaluaciones_nutricionales','orientaciones_guardadas','valoraciones_medicas','alertas','reportes_generados','vw_permisos_usuario','vw_menu_usuario'])await db.$queryRawUnsafe(`SELECT COUNT(*) AS total FROM \`${target}\`.\`${table}\``);
  // Las sesiones copiadas no se usan y la base nunca se conecta a la aplicación.
  await db.registros_auditoria.create({data:{accion:'EXPORTAR',entidad:'respaldos_bd',entidad_id:id,datos_nuevos:JSON.stringify({restauracion_temporal_probada:true,tablas:Number(tables[0].total)})}});
  console.log(`Restauración temporal comprobada: ${tables[0].total} tablas y vistas consultables. La base temporal se elimina al terminar.`);
 } finally {child?.kill('SIGTERM');if(created)await db.$executeRawUnsafe(`DROP DATABASE \`${target}\``);await fsp.rm(tmp,{recursive:true,force:true});}
}
main().catch(e=>{console.error('No se completó la restauración de ensayo:',e.code||e.message);process.exitCode=1}).finally(()=>db.$disconnect());

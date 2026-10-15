// Nunca imprime credenciales ni SQL. El directorio queda fuera del frontend.
require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const { randomBytes, createCipheriv, createDecipheriv, createHash } = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { pipeline } = require('node:stream/promises');
const { Writable } = require('node:stream');
const db = new PrismaClient();
const dir = path.resolve(process.env.BACKUP_DIR || '../database/backups');
function key() {
  const text = process.env.BACKUP_ENCRYPTION_KEY || '';
  if (!/^[a-f0-9]{64}$/i.test(text)) throw new Error('CONFIGURAR_BACKUP_ENCRYPTION_KEY');
  return Buffer.from(text, 'hex');
}
async function digest(file) { const h=createHash('sha256'); for await(const chunk of fs.createReadStream(file)) h.update(chunk); return h.digest(); }
async function verifyFile(file) {
  const size=(await fsp.stat(file)).size;
  if(size<32) throw new Error('ARCHIVO_INVALIDO');
  const h=await fsp.open(file,'r'); const head=Buffer.alloc(16), tag=Buffer.alloc(16);
  try { await h.read(head,0,16,0); await h.read(tag,0,16,size-16); } finally { await h.close(); }
  if(head.subarray(0,4).toString()!=='NTB1') throw new Error('FORMATO_INVALIDO');
  const decipher=createDecipheriv('aes-256-gcm',key(),head.subarray(4)); decipher.setAuthTag(tag);
  await pipeline(fs.createReadStream(file,{start:16,end:size-17}),decipher,new Writable({write(_chunk,_enc,cb){cb();}}));
}
async function create(actor) {
  key();
  await fsp.mkdir(dir,{recursive:true,mode:0o700});
  const lock=await fsp.open(path.join(dir,'.backup.lock'),'wx',0o600);
  let row, tmp, child;
  try {
    row=await db.respaldos_bd.create({data:{destino:'En preparación',estado:'INICIADO',registrado_por:actor}});
    const file=path.join(dir,`nutritech-${row.id}.ntb`);
    tmp=await fsp.mkdtemp(path.join(os.tmpdir(),'nutritech-backup-'));
    const url=new URL(process.env.DATABASE_URL);
    const quote=v=>'"'+v.replaceAll('\\','\\\\').replaceAll('"','\\"').replaceAll('\n','\\n').replaceAll('\r','\\r')+'"';
    const config=path.join(tmp,'client.cnf');
    await fsp.writeFile(config,`[client]\nhost=${quote(url.hostname)}\nport=${url.port||3306}\nuser=${quote(decodeURIComponent(url.username))}\npassword=${quote(decodeURIComponent(url.password))}\n`,{mode:0o600});
    const name=decodeURIComponent(url.pathname.slice(1));
    if(!/^[A-Za-z0-9_]+$/.test(name)) throw new Error('NOMBRE_BASE_INVALIDO');
    const iv=randomBytes(12), cipher=createCipheriv('aes-256-gcm',key(),iv);
    await fsp.writeFile(file,Buffer.concat([Buffer.from('NTB1'),iv]),{flag:'wx',mode:0o600});
    child=spawn('mariadb-dump',[`--defaults-extra-file=${config}`,'--single-transaction','--quick','--routines','--events','--triggers','--hex-blob','--no-tablespaces',name],{stdio:['ignore','pipe','ignore']});
    const done=new Promise((resolve,reject)=>{child.once('error',()=>reject(new Error('MARIADB_DUMP_NO_DISPONIBLE')));child.once('close',code=>code===0?resolve():reject(new Error('FALLO_MARIADB_DUMP')));});
    const timer=setTimeout(()=>child.kill('SIGTERM'),110000);
    try { await Promise.all([pipeline(child.stdout,cipher,fs.createWriteStream(file,{flags:'a'})),done]); } finally { clearTimeout(timer); }
    await fsp.appendFile(file,cipher.getAuthTag());
    await verifyFile(file);
    const sha=await digest(file);
    await db.respaldos_bd.update({where:{id:row.id},data:{destino:path.basename(file),estado:'VERIFICADO',finalizado_en:new Date(),verificado_en:new Date(),tamano_bytes:BigInt((await fsp.stat(file)).size),hash_sha256:sha}});
    await db.registros_auditoria.create({data:{usuario_id:actor,accion:'EXPORTAR',entidad:'respaldos_bd',entidad_id:row.id.toString(),datos_nuevos:JSON.stringify({integridad_verificada:true,restauracion_probada:false})}});
    return {id:row.id.toString(),mensaje:'Respaldo cifrado creado; integridad verificada. No equivale a una restauración de prueba.'};
  } catch(e) {
    child?.kill('SIGTERM');
    if(row) { await fsp.rm(path.join(dir,`nutritech-${row.id}.ntb`),{force:true}); await db.respaldos_bd.update({where:{id:row.id},data:{estado:'FALLIDO',finalizado_en:new Date(),detalle_error:'No se completó el respaldo. Revisa cliente MariaDB, permisos, clave y espacio disponible.'}}); }
    throw e;
  } finally { if(tmp)await fsp.rm(tmp,{recursive:true,force:true});await lock.close();await fsp.rm(path.join(dir,'.backup.lock'),{force:true}); }
}
async function main(){
  const [command,arg]=process.argv.slice(2);
  if(command==='create') { if(arg&&!/^[1-9][0-9]*$/.test(arg))throw new Error('USUARIO_INVALIDO'); return create(arg?BigInt(arg):null); }
  if(command==='verify'&&/^[1-9][0-9]*$/.test(arg||'')) {
    const row=await db.respaldos_bd.findUniqueOrThrow({where:{id:BigInt(arg)}});
    const file=path.join(dir,`nutritech-${row.id}.ntb`);
    if(!row.hash_sha256||!(await digest(file)).equals(Buffer.from(row.hash_sha256)))throw new Error('HASH_INVALIDO');
    await verifyFile(file);
    await db.respaldos_bd.update({where:{id:row.id},data:{verificado_en:new Date(),estado:'VERIFICADO'}});
    return {id:row.id.toString(),mensaje:'Integridad y cifrado verificados; no se ejecutó una restauración.'};
  }
  throw new Error('USO: node scripts/backup.cjs create | verify ID');
}
module.exports = { verifyFile, digest, key };
if (require.main === module) main().then(result=>console.log(JSON.stringify(result))).catch(()=>{console.error('No se completó el respaldo o su verificación. Revisa la configuración y el registro de respaldos.');process.exitCode=1;}).finally(()=>db.$disconnect());

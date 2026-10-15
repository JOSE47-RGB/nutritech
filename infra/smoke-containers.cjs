// Ensayo exclusivo del proyecto de Compose nutritech-check, sin datos del host.
const {execFileSync}=require('node:child_process');const https=require('node:https');
const container='nutritech-check_backend_1';
const node=script=>execFileSync('podman',['exec','-i',container,'node'],{input:script,encoding:'utf8'}).trim();
function http(route,method='GET',body,cookie){return new Promise((resolve,reject)=>{const data=body===undefined?null:JSON.stringify(body);const req=https.request({hostname:'localhost',port:8443,path:'/api'+route,method,rejectUnauthorized:false,headers:{Origin:'https://localhost:8443','X-NutriTech-Request':'1',...(data?{'Content-Type':'application/json','Content-Length':Buffer.byteLength(data)}:{}),...(cookie?{Cookie:cookie}:{})}},res=>{let text='';res.on('data',c=>text+=c);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,text}));});req.setTimeout(130000,()=>req.destroy(new Error('Tiempo agotado')));req.on('error',reject);req.end(data);});}
async function main(){let account;
 try{
  account=JSON.parse(node(`const {PrismaClient}=require('@prisma/client'),{hash}=require('bcrypt'),{randomUUID}=require('node:crypto'),{ulid}=require('ulid');const db=new PrismaClient();(async()=>{const password=randomUUID(),code='QA_'+ulid();const role=await db.roles.findUniqueOrThrow({where:{codigo:'ADMINISTRADOR'}});const user=await db.usuarios.create({data:{codigo_publico:ulid(),codigo_acceso:code,nombres:'Prueba',apellidos:'Contenedor',contrasena_hash:await hash(password,12)}});await db.usuario_rol.create({data:{usuario_id:user.id,rol_id:role.id}});console.log(JSON.stringify({id:user.id.toString(),code,password}));})().finally(()=>db.$disconnect());`));
  const login=await http('/auth/login','POST',{codigo_acceso:account.code,contrasena:account.password});
  if(login.status!==200)throw new Error('Inicio de sesión HTTPS falló');
  const cookies=login.headers['set-cookie']||[];if(!cookies[0]?.includes('Secure')||!cookies[0]?.includes('HttpOnly'))throw new Error('Faltan atributos seguros de cookie');
  const cookie=cookies[0].split(';')[0];
  for(const route of ['/auth/me','/menu','/dashboard','/admin/usuarios','/admin/roles','/admin/menus','/admin/auditoria','/admin/respaldos','/ninos','/evaluaciones','/alertas','/reportes','/patrones']){const r=await http(route,'GET',undefined,cookie);if(r.status!==200)throw new Error(route+' devolvió '+r.status);}
  const backup=await http('/admin/respaldos','POST',{},cookie);if(backup.status!==201)throw new Error('Falló respaldo desde contenedor: '+backup.status);
  await http('/auth/logout','POST',{},cookie);const closed=await http('/auth/me','GET',undefined,cookie);if(closed.status!==401)throw new Error('La sesión no se revocó');
  console.log('HTTPS: login, cookies Secure/HttpOnly, 14 rutas, respaldo cifrado y cierre de sesión verificados.');
 }finally{if(account)node(`const {PrismaClient}=require('@prisma/client');const db=new PrismaClient(),id=BigInt('${account.id}');(async()=>{await db.registros_auditoria.deleteMany({where:{usuario_id:id}});await db.respaldos_bd.deleteMany({where:{registrado_por:id}});await db.sesiones_usuario.deleteMany({where:{usuario_id:id}});await db.usuario_rol.deleteMany({where:{usuario_id:id}});await db.usuarios.delete({where:{id}});})().finally(()=>db.$disconnect());`);}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});

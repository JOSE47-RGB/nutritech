const fs=require('node:fs');const path=require('node:path');const crypto=require('node:crypto');const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),env=path.join(root,'.env'),dir=path.join(__dirname,'certs');
if(!fs.existsSync(env)) {
 const key=()=>crypto.randomBytes(32).toString('hex');
 fs.writeFileSync(env,['DB_PASSWORD','DB_ROOT_PASSWORD','JWT_SECRET','CERTIFICATE_HMAC_KEY','CERTIFICATE_ENCRYPTION_KEY','BACKUP_ENCRYPTION_KEY'].map(name=>`${name}=${key()}`).join('\n')+'\n',{mode:0o600,flag:'wx'});
}
fs.mkdirSync(dir,{recursive:true,mode:0o700});
const cert=path.join(dir,'localhost.crt'),key=path.join(dir,'localhost.key');
if(fs.existsSync(cert)!==fs.existsSync(key))throw new Error('Certificado incompleto: revisa infra/certs sin reemplazar claves existentes.');
if(!fs.existsSync(cert)) {
 execFileSync('openssl',['req','-x509','-newkey','rsa:3072','-nodes','-days','365','-keyout',key,'-out',cert,'-subj','/CN=localhost','-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'],{stdio:'ignore'});
 fs.chmodSync(key,0o600);
}
console.log('Entorno local preparado. Las claves existentes se conservan. Inicia con docker compose up -d --build.');

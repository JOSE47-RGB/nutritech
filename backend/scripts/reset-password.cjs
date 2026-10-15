const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
const { PrismaClient } = require('@prisma/client');
const { hash, compare } = require('bcrypt');
const { createInterface } = require('node:readline/promises');
const { Writable } = require('node:stream');

async function main() {
  if (!process.stdin.isTTY) throw new Error('Ejecuta este comando en una terminal interactiva.');
  const db = new PrismaClient();
  let muted = false;
  const output = new Writable({ write(chunk, encoding, done) {
    if (!muted) process.stdout.write(chunk, encoding);
    done();
  } });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  async function password(prompt) {
    process.stdout.write(prompt);
    muted = true;
    try { return await rl.question(''); }
    finally { muted = false; process.stdout.write('\n'); }
  }
  try {
    const code = (process.argv[2] || await rl.question('Código de acceso de NutriTech: ')).trim();
    const user = await db.usuarios.findUnique({ where: { codigo_acceso: code }, select: { id: true, nombres: true, apellidos: true, estado: true } });
    if (!user) throw new Error('No existe ese código de acceso. No se modificó ninguna cuenta.');
    if (user.estado !== 'ACTIVO') throw new Error('La cuenta no está activa. Restablecer la contraseña no debe cambiar su estado.');
    console.log(`Proyecto: ${path.resolve(__dirname, '..')}`);
    const database = await db.$queryRaw`SELECT DATABASE() AS nombre`;
    console.log(`Base de datos: ${database[0].nombre}`);
    console.log(`Cuenta: ${user.nombres} ${user.apellidos} (${code})`);
    let pass;
    while (true) {
      pass = await password('Contraseña nueva (mínimo 12 caracteres; no se mostrará): ');
      const repeat = await password('Repite exactamente la misma contraseña: ');
      try {
        validatePassword(pass, repeat);
        break;
      } catch (error) {
        console.error(error.message);
        console.log('No se modificó la cuenta. Vuelve a escribir la contraseña a continuación.');
      }
    }
    await resetPassword(db, user.id, pass);
    const verified = await db.usuarios.findUniqueOrThrow({ where: { id: user.id }, select: { contrasena_hash: true, intentos_fallidos: true, bloqueado_hasta: true } });
    if (!await compare(pass, verified.contrasena_hash) || verified.intentos_fallidos !== 0 || verified.bloqueado_hasta) throw new Error('No se pudo verificar el restablecimiento. No se confirmó el cambio.');
    console.log(`VERIFICADO: contraseña guardada y bloqueo eliminado para ${code}. Fecha: ${new Date().toISOString()}`);
    console.log('Se cerraron las sesiones anteriores. Ingresa con ese mismo código y la contraseña que acabas de escribir.');
  } finally {
    rl.close();
    await db.$disconnect();
  }
}
if (require.main === module) main().catch((error) => {
  console.error(error.code ? `No se pudo restablecer la contraseña. Código: ${error.code}` : error.message);
  process.exitCode = 1;
});

async function resetPassword(db, userId, pass) {
  validatePassword(pass, pass);
  const passwordHash = await hash(pass, 12);
  await db.$transaction(async (tx) => {
    // Mismo bloqueo de fila que usa el login: impide dejar una sesión antigua concurrente.
    const rows = await tx.$queryRaw`SELECT id, estado FROM usuarios WHERE id = ${userId} FOR UPDATE`;
    if (!rows.length || rows[0].estado !== 'ACTIVO') throw new Error('La cuenta no está activa.');
    await tx.usuarios.update({ where: { id: userId }, data: { contrasena_hash: passwordHash, intentos_fallidos: 0, bloqueado_hasta: null } });
    await tx.sesiones_usuario.updateMany({ where: { usuario_id: userId, revocada_en: null }, data: { revocada_en: new Date(), motivo_revocacion: 'Restablecimiento local de contraseña' } });
    await tx.registros_auditoria.create({ data: { accion: 'ACTUALIZAR', entidad: 'usuarios', entidad_id: userId.toString(), datos_nuevos: JSON.stringify({ origen: 'restablecimiento_local', sesiones_revocadas: true }) } });
  });
}
function validatePassword(pass, repeat) {
  if (pass.length < 12) throw new Error('La contraseña es demasiado corta: escribe al menos 12 caracteres.');
  if (Buffer.byteLength(pass, 'utf8') > 72) throw new Error('La contraseña supera 72 bytes. Acórtala; letras con tilde y emojis pueden ocupar más de un byte.');
  if (pass !== repeat) throw new Error('Las dos contraseñas no coinciden. Revisa mayúsculas, espacios y la distribución del teclado.');
}
module.exports = { resetPassword, validatePassword };

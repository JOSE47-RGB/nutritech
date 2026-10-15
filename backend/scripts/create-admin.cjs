require('dotenv').config({ quiet: true });
const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcrypt');
const { ulid } = require('ulid');
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
    const exists = await db.usuario_rol.count({ where: { roles: { codigo: 'ADMINISTRADOR' } } });
    if (exists) throw new Error('Ya existe una asignación de administrador. Este comando solo crea el primero y no modifica usuarios existentes.');
    const code = (await rl.question('Código de acceso (3–40 caracteres): ')).trim();
    const nombres = (await rl.question('Nombres: ')).trim();
    const apellidos = (await rl.question('Apellidos: ')).trim();
    const pass = await password('Contraseña (mínimo 12 caracteres; no se mostrará): ');
    const repeat = await password('Repite la contraseña: ');
    if (code.length < 3 || code.length > 40 || !nombres || nombres.length > 120 || !apellidos || apellidos.length > 120) {
      throw new Error('Revisa el código, los nombres y los apellidos.');
    }
    if (pass.length < 12 || Buffer.byteLength(pass, 'utf8') > 72 || pass !== repeat) {
      throw new Error('La contraseña debe coincidir, tener al menos 12 caracteres y ocupar como máximo 72 bytes.');
    }
    const passwordHash = await hash(pass, 12);
    await db.$transaction(async (tx) => {
      const role = await tx.roles.findUnique({ where: { codigo: 'ADMINISTRADOR' } });
      if (!role?.activo) throw new Error('No existe el rol ADMINISTRADOR activo. Revisa los catálogos del SQL.');
      if (await tx.usuarios.findUnique({ where: { codigo_acceso: code } })) {
        throw new Error('Ese código ya existe. No se modificó su contraseña.');
      }
      const user = await tx.usuarios.create({ data: {
        codigo_publico: ulid(), codigo_acceso: code, nombres, apellidos,
        contrasena_hash: passwordHash,
      } });
      await tx.usuario_rol.create({ data: { usuario_id: user.id, rol_id: role.id } });
      await tx.registros_auditoria.create({ data: {
        usuario_id: user.id, accion: 'INSERTAR', entidad: 'usuarios', entidad_id: user.id.toString(),
        datos_nuevos: JSON.stringify({ origen: 'bootstrap_admin' }),
      } });
    });
    console.log('Administrador creado. Ya puedes iniciar sesión con el código y la contraseña que elegiste.');
  } finally {
    rl.close();
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error.code ? `No se pudo crear el administrador. Código: ${error.code}` : error.message);
  process.exitCode = 1;
});

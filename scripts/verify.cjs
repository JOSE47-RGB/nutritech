const { spawnSync } = require('node:child_process');
const { resolve } = require('node:path');
const root = resolve(__dirname, '..');
const integration = process.argv.includes('--database');
if (process.argv.slice(2).some(arg => arg !== '--database')) {
  console.error('Uso: node scripts/verify.cjs [--database]'); process.exit(2);
}
function run(folder, args, env = {}) {
  console.log(`\n[${folder}] npm ${args.join(' ')}`);
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, {
    cwd: resolve(root, folder), stdio: 'inherit', env: { ...process.env, ...env },
  });
  if (result.error) { console.error(result.error.message); process.exit(1); }
  if (result.status !== 0) process.exit(result.status || 1);
}
run('backend', ['exec', '--', 'tsc', '--noEmit']);
run('backend', ['exec', '--', 'eslint', 'src/**/*.ts', 'test/**/*.ts']);
run('backend', ['test', '--', '--runInBand']);
run('backend', ['run', 'test:references']);
run('frontend', ['run', 'build']);
run('frontend', ['test']);
run('frontend', ['run', 'lint']);
if (integration) run('backend', ['run', 'test:e2e', '--', '--runInBand'], { RUN_DB_TESTS: '1' });
console.log(integration ? '\nVerificación técnica y de integración completada.' : '\nVerificación estática y unitaria completada. MariaDB no se comprobó; usa npm run verify:db.');

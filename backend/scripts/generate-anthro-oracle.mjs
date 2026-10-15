// Ejecuta fuentes R oficiales sin modificarlas. WebR es una dependencia de desarrollo externa.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../database/references/anthro-1.1.0');
const modulePath =
  process.env.WEBR_MODULE ||
  path.resolve(
    here,
    '../../../../work/anthro-oracle/node_modules/webr/dist/webr.mjs',
  );
const { WebR } = await import(pathToFileURL(modulePath).href);
const r = new WebR();
const cases = [];
for (const sexo of ['M', 'F'])
  for (const edad_dias of [0, 100, 273, 274, 730, 731, 987, 1522, 1826, 1827])
    for (const tipo_medicion of ['LONGITUD_ACOSTADO', 'TALLA_DE_PIE'])
      for (const [peso_kg, talla_cm] of [
        [3.35, 49.88],
        [12.35, 85.25],
        [17, 110],
        [0.3, 45],
        [50, 120],
      ])
        for (const edema of ['NO', 'SI'])
          cases.push({
            sexo,
            edad_dias,
            peso_kg,
            talla_cm,
            tipo_medicion,
            edema,
          });
let seed = 4711;
function random() {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 4294967296;
}
for (let i = 0; i < 100; i++)
  cases.push({
    sexo: random() < 0.5 ? 'M' : 'F',
    edad_dias: Math.floor(random() * 1827),
    peso_kg: Math.round((0.3 + random() * 35) * 100) / 100,
    talla_cm: Math.round((40 + random() * 85) * 100) / 100,
    tipo_medicion: random() < 0.5 ? 'LONGITUD_ACOSTADO' : 'TALLA_DE_PIE',
    edema: 'NO',
  });
function vector(key, transform = (value) => value) {
  return (
    'c(' +
    cases.map((row) => JSON.stringify(transform(row[key]))).join(',') +
    ')'
  );
}
try {
  await r.init();
  const sources = JSON.parse(
    fs.readFileSync(
      path.join(root, 'calculation-source/manifest.json'),
      'utf8',
    ),
  );
  for (const item of sources) {
    const bytes = fs.readFileSync(
      path.join(root, 'calculation-source', item.file),
    );
    if (createHash('sha256').update(bytes).digest('hex') !== item.sha256)
      throw Error('Fuente R alterada: ' + item.file);
    await r.FS.writeFile('/tmp/' + item.file, bytes);
  }
  for (const file of [
    'anthro-package.R',
    'utils.R',
    'assertions.R',
    ...sources
      .map((x) => x.file)
      .filter((n) => n.startsWith('z-score') && n.endsWith('.R')),
  ])
    await r.evalRVoid(`source('/tmp/${file}')`);
  for (const file of [
    'weianthro',
    'lenanthro',
    'bmianthro',
    'wflanthro',
    'wfhanthro',
    'hcanthro',
    'acanthro',
    'tsanthro',
    'ssanthro',
  ]) {
    const location = fs.existsSync(path.join(root, file + '.txt'))
      ? path.join(root, file + '.txt')
      : path.join(root, 'calculation-source', file + '.txt');
    await r.FS.writeFile('/tmp/' + file + '.txt', fs.readFileSync(location));
    await r.evalRVoid(
      `growthstandards_${file} <- read.delim('/tmp/${file}.txt')`,
    );
  }
  await r.evalRVoid(
    `result <- anthro_zscores(sex=${vector('sexo')},age=${vector('edad_dias')},is_age_in_month=FALSE,weight=${vector('peso_kg')},lenhei=${vector('talla_cm')},measure=${vector('tipo_medicion', (v) => (v === 'TALLA_DE_PIE' ? 'h' : 'l'))},oedema=${vector('edema', (v) => (v === 'SI' ? 'y' : 'n'))})`,
  );
  const columns = {};
  for (const key of [
    'clenhei',
    'cmeasure',
    'c9mo_flag',
    'cbmi',
    'zlen',
    'flen',
    'zwei',
    'fwei',
    'zwfl',
    'fwfl',
    'zbmi',
    'fbmi',
  ])
    columns[key] = await (await r.evalR(`result$${key}`)).toArray();
  const fixture = {
    source: 'WorldHealthOrganization/anthro',
    version: '1.1.0',
    commit: '80c8db44575425463423ed07bddfd79a3a3301b9',
    runtime: await r.evalRString('R.version.string'),
    cases: cases.map((input, i) => ({
      input,
      expected: Object.fromEntries(
        Object.entries(columns).map(([k, v]) => [k, v[i]]),
      ),
    })),
  };
  fs.writeFileSync(
    path.join(root, 'oracle-cases.json'),
    JSON.stringify(fixture, null, 2) + '\n',
  );
  console.log(
    JSON.stringify({ casos: cases.length, runtime: fixture.runtime }),
  );
} finally {
  await r.close();
}

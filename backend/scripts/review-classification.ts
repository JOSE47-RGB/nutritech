import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import {
  classificationProposal,
  validateDraft,
} from '../src/nutrition/classification-draft';
const directory = resolve(
  __dirname,
  '../../database/references/classification',
);
const manifest = JSON.parse(
  readFileSync(resolve(directory, 'manifest.json'), 'utf8'),
) as { archivo: string; sha256: string };
const hash = createHash('sha256')
  .update(readFileSync(resolve(directory, manifest.archivo)))
  .digest('hex');
if (hash !== manifest.sha256)
  throw Error('El PDF de referencia no coincide con la huella registrada');
const proposal = classificationProposal();
const report = {
  revisado_en: new Date().toISOString(),
  version: proposal.version,
  estado: proposal.estado,
  fuente_sha256: hash,
  revision_tecnica: validateDraft(),
  revision_clinica: proposal.revision_clinica,
  prioridades: 'PENDIENTES',
  reglas_activadas: false,
  escritura_en_base: false,
};
writeFileSync(
  resolve(directory, 'rules-draft.json'),
  JSON.stringify(proposal, null, 2) + '\n',
);
writeFileSync(
  resolve(directory, 'review-report.json'),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report, null, 2));

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');
const configPath = path.join(root, 'config', 'production-target.json');

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const expected = config.productionLovableProjectId;
const supplied =
  process.argv[2] ||
  process.env.BACKEND_TARGET_PROJECT_ID ||
  process.env.LOVABLE_PROJECT_ID ||
  '';

if (!supplied) {
  console.error('BACKEND TARGET GUARD: project_id não informado.');
  console.error(
    `Informe explicitamente o projeto conectado: bun run guard:backend -- ${expected}`,
  );
  console.error('Operação mutável de banco/deploy deve ser interrompida.');
  process.exit(2);
}

const legacy = config.legacyForbiddenTargets.find((target) => target.id === supplied);
if (legacy) {
  console.error('BACKEND TARGET GUARD: ALVO LEGADO PROIBIDO.');
  console.error(`ID recebido: ${supplied}`);
  console.error(`Motivo: ${legacy.reason}`);
  console.error(`Produção autorizada: ${expected}`);
  process.exit(3);
}

if (supplied !== expected) {
  console.error('BACKEND TARGET GUARD: projeto conectado não corresponde à produção canônica.');
  console.error(`ID recebido: ${supplied}`);
  console.error(`ID autorizado: ${expected}`);
  console.error('Não execute migration, SQL, deploy ou escrita até validar o alvo correto.');
  process.exit(4);
}

console.log('BACKEND TARGET GUARD: OK');
console.log(`Projeto autorizado: ${expected}`);
console.log(`Backend: ${config.backendProvider}`);
console.log(`Workspace: ${config.workspaceName}`);

// Deploys the staging stack and writes its frontend outputs into .env.
// Run through `npm run staging`, which loads .env so AWS_PROFILE and CDK_DEFAULT_* apply here.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const ENV_FILE = '.env';

function run(command, args) {
  const { status } = spawnSync(command, args, { stdio: 'inherit' });
  if (status !== 0) process.exit(status ?? 1);
}

const signedIn =
  spawnSync('aws', ['sts', 'get-caller-identity'], { stdio: 'ignore' })
    .status === 0;
if (!signedIn) run('aws', ['sso', 'login']);

run('npx', [
  'cdk',
  'deploy',
  'Wildshoot-staging',
  '--context',
  'stage=staging',
]);

const region = process.env.CDK_DEFAULT_REGION;
const outputs = JSON.parse(
  execFileSync(
    'aws',
    [
      'cloudformation',
      'describe-stacks',
      '--stack-name',
      'wildshoot-staging',
      '--query',
      'Stacks[0].Outputs',
      '--output',
      'json',
      ...(region ? ['--region', region] : []),
    ],
    { encoding: 'utf8' }
  )
);

// Each frontend output's description is the .env key it belongs in.
let env = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : '';
for (const { Description: key, OutputValue: value } of outputs) {
  if (!key?.startsWith('NUXT_PUBLIC_')) continue;
  const line = `${key}=${value}`;
  const existing = new RegExp(`^[ \\t]*${key}=.*$`, 'm');
  env = existing.test(env)
    ? env.replace(existing, line)
    : `${env.trimEnd()}\n${line}\n`;
  console.log(line);
}
writeFileSync(ENV_FILE, env);
console.log(`Updated ${ENV_FILE}`);

import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const root = new URL('..', import.meta.url).pathname;

const requiredFiles = [
  '.nvmrc',
  '.env.example',
  '.env.production.example',
  'vercel.json',
  'render.yaml',
  'server/.env.production.example',
  'server/prisma/schema.prisma',
  'server/prisma/migrations/migration_lock.toml',
];

const requiredEnvKeys = {
  '.env.production.example': ['VITE_API_URL'],
  'server/.env.production.example': ['NODE_ENV', 'DATABASE_URL', 'JWT_SECRET', 'JWT_EXPIRES_IN', 'CORS_ORIGIN'],
};

const checks = [];

const addCheck = (name, run) => {
  checks.push({ name, run });
};

const fail = (message) => {
  throw new Error(message);
};

const read = (path) => readFileSync(new URL(path, `file://${root}/`), 'utf8');

const run = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: false,
    ...options,
  });

  if (result.status !== 0) {
    fail(`${command} ${args.join(' ')} failed`);
  }
};

addCheck('required deployment files exist', () => {
  for (const file of requiredFiles) {
    if (!existsSync(new URL(file, `file://${root}/`))) {
      fail(`Missing ${file}`);
    }
  }
});

addCheck('production env examples include required keys', () => {
  for (const [file, keys] of Object.entries(requiredEnvKeys)) {
    const body = read(file);
    for (const key of keys) {
      if (!new RegExp(`^${key}=`, 'm').test(body)) {
        fail(`${file} is missing ${key}`);
      }
    }
  }
});

addCheck('deployment config files are parseable', () => {
  JSON.parse(read('package.json'));
  JSON.parse(read('server/package.json'));
  JSON.parse(read('vercel.json'));

  const render = read('render.yaml');
  for (const required of ['writehabit-api', 'rootDir: server', 'healthCheckPath: /api/ready']) {
    if (!render.includes(required)) {
      fail(`render.yaml is missing ${required}`);
    }
  }
});

addCheck('node version is compatible', () => {
  const expectedMajor = read('.nvmrc').trim().split('.')[0];
  const actualMajor = process.versions.node.split('.')[0];
  if (actualMajor !== expectedMajor) {
    fail(`Expected Node ${expectedMajor}.x, got ${process.versions.node}`);
  }
});

addCheck('frontend build passes', () => {
  run('npm', ['run', 'build']);
});

addCheck('prisma client generation passes', () => {
  run('npm', ['run', 'prisma:generate']);
});

addCheck('backend smoke tests pass', () => {
  run('npm', ['--prefix', 'server', 'test']);
});

for (const check of checks) {
  process.stdout.write(`\n[predeploy] ${check.name}\n`);
  check.run();
}

process.stdout.write('\n[predeploy] all checks passed\n');

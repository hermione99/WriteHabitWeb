import { access, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';

const args = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const key = process.argv[i];
  const value = process.argv[i + 1];
  if (key.startsWith('--') && value && !value.startsWith('--')) {
    args.set(key.slice(2), value);
    i += 1;
  }
}

const databaseUrl = args.get('url') || process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('DATABASE_URL is required. Example: DATABASE_URL="postgresql://..." npm run backup:db');
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = resolve(args.get('dir') || 'backups');
const outputFile = resolve(outputDir, args.get('file') || `writehabit-${stamp}.dump`);

await mkdir(outputDir, { recursive: true });

const candidateBins = [
  args.get('pg-dump'),
  process.env.PG_DUMP_BIN,
  '/opt/homebrew/opt/postgresql@17/bin/pg_dump',
  '/usr/local/opt/postgresql@17/bin/pg_dump',
  'pg_dump',
].filter(Boolean);

let pgDumpBin = 'pg_dump';
for (const candidate of candidateBins) {
  if (candidate === 'pg_dump') {
    pgDumpBin = candidate;
    break;
  }
  try {
    await access(candidate);
    pgDumpBin = candidate;
    break;
  } catch {}
}

const pgDump = spawn(pgDumpBin, [
  '--format=custom',
  '--no-owner',
  '--no-acl',
  '--file',
  outputFile,
  databaseUrl,
], {
  stdio: ['ignore', 'inherit', 'inherit'],
});

pgDump.on('error', (error) => {
  if (error.code === 'ENOENT') {
    console.error('pg_dump was not found. Install PostgreSQL client tools and make sure pg_dump is in PATH, or pass --pg-dump /path/to/pg_dump.');
  } else {
    console.error(error.message);
  }
  process.exit(1);
});

pgDump.on('close', (code) => {
  if (code !== 0) {
    process.exit(code);
  }
  console.log(`Database backup written to ${outputFile}`);
});

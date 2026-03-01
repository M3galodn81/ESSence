// scripts/nuke-db.ts
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

const dbPath = path.join(process.cwd(), 'ESS.db');

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { stdio: 'inherit', shell: true });
    proc.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed with code ${code}`));
    });
    proc.on('error', reject);
  });
}

async function main() {
  console.log('\n🧨 AUTOMATED DB NUKE INITIATED 🧨\n');
  
  const pathsToDelete = [
    dbPath,
    `${dbPath}-shm`,
    `${dbPath}-wal`,
    path.join(process.cwd(), 'migrations'),
    path.join(process.cwd(), 'drizzle'),
    path.join(process.cwd(), 'server', 'migrations')
  ];

  pathsToDelete.forEach(targetPath => {
    if (fs.existsSync(targetPath)) {
      if (fs.statSync(targetPath).isDirectory()) {
        fs.rmSync(targetPath, { recursive: true, force: true });
      } else {
        fs.unlinkSync(targetPath);
      }
      console.log(`   Deleted: ${path.basename(targetPath)}`);
    }
  });

  console.log('\n🔄 Generating and applying fresh schema...');
  await runCommand('npx', ['drizzle-kit', 'generate']);
  await runCommand('npm', ['run', 'db:migrate']);
  
  console.log('\n✅ Database nuked and ready for E2E tests (No seeding).\n');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
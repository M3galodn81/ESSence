import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const dbPath = path.join(process.cwd(), 'ESS.db');
const dbExists = fs.existsSync(dbPath);

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function main() {
  console.log('\n🚀 ESSence Development Server Setup\n');

  if (dbExists) {
    console.log('📊 Existing database found: ESS.db\n');
    console.log('Choose an option:');
    console.log('  1. Use existing database (keep all data)');
    console.log('  2. Create new database (delete existing data)');
    console.log('  3. Cancel\n');

    const answer = await question('Enter your choice (1-3): ');

    if (answer.trim() === '3') {
      console.log('\n❌ Cancelled. Exiting...\n');
      rl.close();
      process.exit(0);
    } else if (answer.trim() === '2') {
      console.log('\n⚠️  WARNING: This will delete all existing data!');
      const confirm = await question('Are you sure? Type "yes" to confirm: ');

      if (confirm.trim().toLowerCase() === 'yes') {
        console.log('\n🗑️  Deleting existing database...');

        // Delete database and related files
        const filesToDelete = [
          dbPath,
          `${dbPath}-shm`,
          `${dbPath}-wal`
        ];

        filesToDelete.forEach(file => {
          if (fs.existsSync(file)) {
            fs.unlinkSync(file);
            console.log(`   Deleted: ${path.basename(file)}`);
          }
        });

        console.log('✅ Database deleted successfully\n');
        console.log('🔄 Running migrations to create new database...\n');

        // Run migrations
        await runCommand('npm', ['run', 'db:migrate']);

        console.log('\n✅ New database created successfully\n');
      } else {
        console.log('\n❌ Database deletion cancelled. Using existing database.\n');
      }
    } else if (answer.trim() === '1') {
      console.log('\n✅ Using existing database\n');
    } else {
      console.log('\n❌ Invalid option. Using existing database.\n');
    }
  } else {
    console.log('📊 No existing database found.\n');
    console.log('🔄 Creating new database...\n');
    
    // Run migrations
    await runCommand('npm', ['run', 'db:migrate']);
    
    console.log('\n✅ Database created successfully\n');
  }

  rl.close();

  console.log('🚀 Starting development server...\n');
  console.log('─'.repeat(50));
  console.log('\n');

  // Start the dev server
  const devProcess = spawn('tsx', ['server/index.ts'], {
    stdio: 'inherit',
    env: { ...process.env, NODE_ENV: 'development' },
    shell: true
  });

  devProcess.on('exit', (code) => {
    process.exit(code || 0);
  });

  // Handle termination signals
  process.on('SIGINT', () => {
    devProcess.kill('SIGINT');
  });

  process.on('SIGTERM', () => {
    devProcess.kill('SIGTERM');
  });
}

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: 'inherit',
      shell: true
    });

    proc.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Command failed with exit code ${code}`));
      }
    });

    proc.on('error', (error) => {
      reject(error);
    });
  });
}

main().catch((error) => {
  console.error('\n❌ Error:', error.message);
  rl.close();
  process.exit(1);
});


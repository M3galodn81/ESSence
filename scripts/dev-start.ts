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
    console.log('  1. Use existing database (keep all data, start server)');
    console.log('  2. Update schema (generate & run migrations)');
    console.log('  3. Create new database (no seeding)');
    console.log('  4. Create new database and re-seed');
    console.log('  5. Cancel\n');

    const answer = await question('Enter your choice (1-5): ');

    if (answer.trim() === '5') {
      console.log('\n❌ Cancelled. Exiting...\n');
      rl.close();
      process.exit(0);
    } else if (answer.trim() === '2') {
      console.log('\n🔄 Updating database schema...');
      console.log('How would you like to apply the schema changes?');
      console.log('  1. Retain database (Safely generate and apply migrations)');
      console.log('  2. Nuke it! (Delete DB & history, apply new schema, and re-seed)');
      
      const schemaOption = await question('\nEnter your choice (1-2): ');

      if (schemaOption.trim() === '2') {
        await nukeDatabase(true); // true = seed after nuke
      } else {
        // Default to safe update
        console.log('\n🔄 Applying schema changes safely (Retaining data)...');
        try {
          console.log('-> Generating new migrations...');
          await runCommand('npx', ['drizzle-kit', 'generate']);
          
          console.log('-> Applying migrations...');
          await runCommand('npm', ['run', 'db:migrate']);
          
          console.log('✅ Schema updated successfully\n');
        } catch (error) {
          console.error('\n❌ Failed to update schema. Please check your schema.ts for errors.\n');
          rl.close();
          process.exit(1);
        }
      }

    } else if (answer.trim() === '3') {
      await nukeDatabase(false); // false = don't seed
    } else if (answer.trim() === '4') {
      await nukeDatabase(true);  // true = seed
    } else if (answer.trim() === '1') {
      console.log('\n✅ Using existing database\n');
    } else {
      console.log('\n❌ Invalid option. Using existing database.\n');
    }
  } else {
    console.log('📊 No existing database found.\n');
    
    console.log('🔄 Running migrations to create new database...');
    await runCommand('npx', ['drizzle-kit', 'generate']);
    await runCommand('npm', ['run', 'db:migrate']);
    console.log('✅ Migrations complete\n');

    console.log('Would you like to seed the new database with initial data?');
    console.log('  1. Yes, seed it');
    console.log('  2. No, leave it empty\n');
    
    const seedAnswer = await question('Enter your choice (1-2): ');
    
    if (seedAnswer.trim() === '1') {
        console.log('\n🌱 Seeding the database with fresh data...');
        await runCommand('npm', ['run', 'db:seed']);
        console.log('✅ Seeding complete\n');
    } else {
        console.log('\n✅ Database created empty.\n');
    }
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

// Extracted the Nuke logic into a reusable function
async function nukeDatabase(shouldSeed: boolean) {
  console.log('\n⚠️  WARNING: This will delete all existing data AND migration history!');
  const confirm = await question('Are you sure? Type "yes" to confirm: ');

  if (confirm.trim().toLowerCase() === 'yes') {
    console.log('\n🗑️  Deleting existing database and migration history...');

    // We target the DB files AND common Drizzle migration output folders
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

    console.log('✅ Database and history deleted successfully\n');
    
    console.log('🔄 Generating and applying fresh schema...');
    await runCommand('npx', ['drizzle-kit', 'generate']);
    await runCommand('npm', ['run', 'db:migrate']);
    console.log('✅ Migrations complete\n');

    if (shouldSeed) {
        console.log('🌱 Seeding the database with fresh data...');
        await runCommand('npm', ['run', 'db:seed']);
        console.log('✅ Seeding complete\n');
    } else {
        console.log('✅ Database created empty (No seeding).\n');
    }

  } else {
    console.log('\n❌ Database deletion cancelled. Using existing database.\n');
  }
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
@REM Git pull
git reset --hard HEAD 
git clean -fd 
git pull 

@REM Install packages (Fixed: removed 'package.json')
call npm install

@REM Push Database Schema
call npx drizzle-kit push

@REM Adding dummy data 
call npx tsx ./client/scripts/seed_users.tsx
call npx tsx ./client/scripts/seed_schedules.tsx

npm run dev
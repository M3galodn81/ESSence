git fetch --all
git reset --hard origin/main

rm migrations
rm ESS.db

npx drizzle-kit push
npx tsx ./client/scripts/mega_seed.tsx

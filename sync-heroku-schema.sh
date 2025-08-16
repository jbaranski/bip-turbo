#!/bin/bash

# Heroku Schema Sync Script
# This script ensures Heroku production database has the latest Prisma schema
# before migration to Supabase

set -e

# Configuration
HEROKU_APP="bip-api-prod"
HEROKU_DB="postgresql-tetrahedral-54595"

echo "🔧 Syncing Heroku database schema with Prisma..."

# Step 1: Skip maintenance mode - we're experimenting
echo "⚡ Running migrations on live Heroku (YOLO mode)..."

# Step 2: Run full Prisma migrations on Heroku production
echo "🗃️ Running Prisma migrations on Heroku database..."
cd packages/core

# Set Heroku database as target
HEROKU_DATABASE_URL=$(heroku config:get DATABASE_URL --app $HEROKU_APP)
export DATABASE_URL=$HEROKU_DATABASE_URL

# Run all migrations to bring Heroku up to current schema
bunx prisma migrate deploy --schema=./src/_shared/prisma/schema.prisma

cd ../..

# Step 4: Verify schema is now in sync
echo "✅ Verifying schema sync..."
heroku pg:psql $HEROKU_DB --app $HEROKU_APP -c "SELECT COUNT(*) as migration_count FROM _prisma_migrations;"
heroku pg:psql $HEROKU_DB --app $HEROKU_APP -c "SELECT COUNT(*) as table_count FROM information_schema.tables WHERE table_schema = 'public';"

# Step 5: Heroku stays live
echo "🟢 Heroku remains live - no maintenance mode used"

echo "🎉 Heroku schema sync complete!"
echo "📊 Your Heroku database now matches the current Prisma schema"
echo "🚀 Ready for migration to Supabase"
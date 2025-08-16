#!/bin/bash

# Production Heroku to Supabase Migration Script
set -e

# Configuration
HEROKU_APP="bip-api-prod"
HEROKU_DB="postgresql-tetrahedral-54595"
DOPPLER_CONFIG=${1:-prd}

# Get production Supabase credentials from Doppler
echo "🔑 Loading Supabase credentials from Doppler config: $DOPPLER_CONFIG..."
eval $(doppler secrets download --no-file --format env --project bip --config $DOPPLER_CONFIG | grep -E '^(PROD_SUPABASE_|DATABASE_URL)')

# Extract Supabase connection details from Doppler
PROD_SUPABASE_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
PROD_SUPABASE_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
PROD_SUPABASE_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
PROD_SUPABASE_PASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
PROD_SUPABASE_DB=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')

# Fallback to specific env vars if DATABASE_URL parsing fails
PROD_SUPABASE_HOST=${PROD_SUPABASE_HOST:-$PROD_SUPABASE_HOST_ENV}
PROD_SUPABASE_PORT=${PROD_SUPABASE_PORT:-$PROD_SUPABASE_PORT_ENV}
PROD_SUPABASE_USER=${PROD_SUPABASE_USER:-$PROD_SUPABASE_USER_ENV}
PROD_SUPABASE_PASSWORD=${PROD_SUPABASE_PASSWORD:-$PROD_SUPABASE_PASSWORD_ENV}
PROD_SUPABASE_DB=${PROD_SUPABASE_DB:-$PROD_SUPABASE_DB_ENV}

echo "📍 Target: $PROD_SUPABASE_HOST:$PROD_SUPABASE_PORT/$PROD_SUPABASE_DB"

echo "🚀 Starting Heroku to PRODUCTION Supabase migration..."
echo "⚠️  WARNING: This will migrate to PRODUCTION Supabase!"
read -p "Are you sure you want to continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Migration cancelled"
    exit 1
fi

# Step 1: Export data from Heroku (leave Heroku live - no maintenance mode)
echo "💾 Creating backup while Heroku stays live..."
BACKUP_ID=$(heroku pg:backups:capture $HEROKU_DB --app $HEROKU_APP | grep -o 'b[0-9]\+')
echo "📥 Downloading backup $BACKUP_ID..."
heroku pg:backups:download $BACKUP_ID --app $HEROKU_APP -o production_backup.dump

# Step 2: Clear production Supabase database
echo "🧹 Clearing PRODUCTION Supabase database..."
echo "⚠️  This will DELETE ALL DATA in production Supabase!"
read -p "Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Migration cancelled"
    exit 1
fi

PGPASSWORD=$PROD_SUPABASE_PASSWORD psql -h $PROD_SUPABASE_HOST -p $PROD_SUPABASE_PORT -U $PROD_SUPABASE_USER -d $PROD_SUPABASE_DB -c "
DROP SCHEMA public CASCADE; 
CREATE SCHEMA public;
CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"; 
CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";
"

# Step 3: Run Prisma migrations to build proper schema
echo "🔧 Building proper schema with Prisma migrations..."
cd packages/core

# Use production environment variables for this step
export DATABASE_URL="postgresql://$PROD_SUPABASE_USER:$PROD_SUPABASE_PASSWORD@$PROD_SUPABASE_HOST:$PROD_SUPABASE_PORT/$PROD_SUPABASE_DB"
bunx prisma migrate deploy --schema=./src/_shared/prisma/schema.prisma

cd ../..

# Step 4: Extract and import data only
echo "📊 Extracting data from Heroku backup..."
pg_restore --data-only --no-acl --no-owner -f data.sql production_backup.dump
sed -i '' '/transaction_timeout/d' data.sql

# Step 5: Import data with constraints disabled
echo "📥 Importing data to properly structured Supabase..."
PGPASSWORD=$PROD_SUPABASE_PASSWORD psql -h $PROD_SUPABASE_HOST -p $PROD_SUPABASE_PORT -U $PROD_SUPABASE_USER -d $PROD_SUPABASE_DB << EOF
SET session_replication_role = replica;
\i data.sql
SET session_replication_role = default;
EOF

# Step 6: Verify import
echo "✅ Verifying import..."
TABLE_COUNT=$(PGPASSWORD=$PROD_SUPABASE_PASSWORD psql -h $PROD_SUPABASE_HOST -p $PROD_SUPABASE_PORT -U $PROD_SUPABASE_USER -d $PROD_SUPABASE_DB -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo "📊 Imported $TABLE_COUNT tables"

# Step 7: Generate Prisma client for production
echo "🔄 Generating Prisma client..."
cd packages/core
bunx prisma generate --schema=./src/_shared/prisma/schema.prisma
cd ../..

# Cleanup
echo "🧹 Cleaning up temporary files..."
rm -f schema.sql data.sql

echo "🎉 PRODUCTION Migration complete!"
echo "📊 Tables imported: $TABLE_COUNT"
echo "💾 Backup file: production_backup.dump"
echo "🚀 Your production Supabase is now ready!"
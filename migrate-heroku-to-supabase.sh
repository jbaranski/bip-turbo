#!/bin/bash

# Heroku to Supabase Migration Script
set -e

# Configuration
HEROKU_APP="bip-api-prod"
HEROKU_DB="postgresql-tetrahedral-54595"
SUPABASE_HOST="127.0.0.1"
SUPABASE_PORT="54322"
SUPABASE_USER="postgres"
SUPABASE_PASSWORD="postgres"
SUPABASE_DB="postgres"

echo "🚀 Starting Heroku to Supabase migration..."

# Step 1: Put Heroku app in maintenance mode
echo "📴 Enabling maintenance mode on $HEROKU_APP..."
heroku maintenance:on --app $HEROKU_APP

# Step 2: Create and download backup
echo "💾 Creating backup of $HEROKU_DB..."
BACKUP_ID=$(heroku pg:backups:capture $HEROKU_DB --app $HEROKU_APP | grep -o 'b[0-9]\+')
echo "📥 Downloading backup $BACKUP_ID..."
heroku pg:backups:download $BACKUP_ID --app $HEROKU_APP -o production_backup.dump

# Step 3: Clear local Supabase database
echo "🧹 Clearing local Supabase database..."
PGPASSWORD=$SUPABASE_PASSWORD psql -h $SUPABASE_HOST -p $SUPABASE_PORT -U $SUPABASE_USER -d $SUPABASE_DB -c "
DROP SCHEMA public CASCADE; 
CREATE SCHEMA public;
CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"; 
CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";
"

# Step 4: Extract and fix schema
echo "🔧 Extracting and fixing schema..."
pg_restore --schema-only --no-acl --no-owner -f schema.sql production_backup.dump
sed -i '' 's/"public"\."gen_random_uuid"()/gen_random_uuid()/g' schema.sql
sed -i '' '/transaction_timeout/d' schema.sql

# Step 5: Import schema
echo "📋 Importing schema..."
PGPASSWORD=$SUPABASE_PASSWORD psql -h $SUPABASE_HOST -p $SUPABASE_PORT -U $SUPABASE_USER -d $SUPABASE_DB -f schema.sql

# Step 6: Extract and fix data
echo "📊 Extracting and fixing data..."
pg_restore --data-only --no-acl --no-owner -f data.sql production_backup.dump
sed -i '' '/transaction_timeout/d' data.sql

# Step 7: Import data with constraints disabled
echo "📥 Importing data..."
PGPASSWORD=$SUPABASE_PASSWORD psql -h $SUPABASE_HOST -p $SUPABASE_PORT -U $SUPABASE_USER -d $SUPABASE_DB << EOF
SET session_replication_role = replica;
\i data.sql
SET session_replication_role = default;
EOF

# Step 8: Verify import
echo "✅ Verifying import..."
TABLE_COUNT=$(PGPASSWORD=$SUPABASE_PASSWORD psql -h $SUPABASE_HOST -p $SUPABASE_PORT -U $SUPABASE_USER -d $SUPABASE_DB -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
echo "📊 Imported $TABLE_COUNT tables"

# Step 9: Baseline Prisma migrations (mark existing migrations as applied)
echo "🔧 Baselining Prisma migrations..."
cd packages/core
doppler run -- bunx prisma migrate resolve --applied 20240320000000_create_blog_images_bucket --schema=./src/_shared/prisma/schema.prisma || true

# Step 10: Run any new migrations
echo "📈 Running new Prisma migrations..."
doppler run -- bun prisma:migrate:dev || true

# Step 11: Generate Prisma client
echo "🔄 Generating Prisma client..."
doppler run -- bun prisma:generate

cd ../..

# Step 12: Take Heroku app out of maintenance mode
echo "🟢 Disabling maintenance mode on $HEROKU_APP..."
heroku maintenance:off --app $HEROKU_APP

# Cleanup
echo "🧹 Cleaning up temporary files..."
rm -f schema.sql data.sql

echo "🎉 Migration complete!"
echo "📊 Tables imported: $TABLE_COUNT"
echo "💾 Backup file: production_backup.dump"
echo "⚠️  Remember to run this same process for production Supabase when ready!"
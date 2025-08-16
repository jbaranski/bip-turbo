#!/usr/bin/env bun

/**
 * Migrate users from custom users table to Supabase auth.users
 * This creates auth users and links them to existing user records
 */

import { createClient } from '@supabase/supabase-js';

// Get environment variables
const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const databaseUrl = process.env.DATABASE_URL!;

if (!supabaseUrl || !supabaseServiceRoleKey || !databaseUrl) {
  console.error('Missing required environment variables');
  console.error('Need: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DATABASE_URL');
  process.exit(1);
}

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function migrateUsers() {
  console.log('🚀 Starting user migration to Supabase auth...');
  
  // Get users from your custom table
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: databaseUrl });
  
  try {
    const result = await pool.query(`
      SELECT id, email, first_name, last_name, username, created_at 
      FROM users 
      WHERE email IS NOT NULL 
      ORDER BY created_at ASC
    `);
    
    const users = result.rows;
    console.log(`📊 Found ${users.length} users to migrate`);
    
    let migrated = 0;
    let errors = 0;
    
    for (const user of users) {
      try {
        // Create auth user in Supabase
        const { data: authUser, error } = await supabase.auth.admin.createUser({
          email: user.email,
          user_metadata: {
            first_name: user.first_name,
            last_name: user.last_name,
            username: user.username,
            custom_user_id: user.id, // Link to existing user record
          },
          email_confirm: true, // Skip email confirmation
        });
        
        if (error) {
          if (error.message.includes('already registered')) {
            console.log(`⚠️  User ${user.email} already exists in auth`);
            continue;
          }
          throw error;
        }
        
        migrated++;
        
        if (migrated % 50 === 0) {
          console.log(`✅ ${migrated}/${users.length} users migrated`);
        }
        
        // Rate limit to avoid hitting Supabase limits
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Failed to migrate user ${user.email}:`, error);
        errors++;
      }
    }
    
    console.log(`\n🎉 Migration complete!`);
    console.log(`✅ Successfully migrated: ${migrated} users`);
    console.log(`❌ Errors: ${errors} users`);
    
  } catch (error) {
    console.error('💥 Migration failed:', error);
  } finally {
    await pool.end();
  }
}

migrateUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
#!/usr/bin/env node

/**
 * Database Migration Runner
 * Runs the confidence scores migration against the database
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load environment variables from root directory
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

async function runMigration() {
  // Database connection configuration
  const client = new Client({
    host: process.env.DATABASE_HOST || 'localhost',
    port: process.env.DATABASE_PORT || 5432,
    database: process.env.DATABASE_NAME || 'marshapp',
    user: process.env.DATABASE_USERNAME || 'marshapp_user',
    password: process.env.DATABASE_PASSWORD || 'marshapp_password',
  });

  try {
    console.log('Connecting to database...');
    await client.connect();

    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '001_add_confidence_scores.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('Running migration: Add confidence scores and additional fields...');

    // Execute migration
    await client.query(migrationSQL);

    console.log('Migration completed successfully!');

    // Verify the new columns exist
    const result = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'audio_analyses' 
      AND column_name IN ('tempo_confidence', 'key_confidence', 'genre_confidence', 'secondary_genres', 'mood_tags', 'energy', 'valence')
      ORDER BY column_name;
    `);

    console.log('\nNew columns added:');
    result.rows.forEach(row => {
      console.log(`- ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

// Run migration if called directly
if (require.main === module) {
  runMigration().catch(console.error);
}

module.exports = { runMigration };

const { Client } = require('pg');

const connectionStrings = [
  // Direct connection with SSL
  'postgresql://postgres:0VnSw8grsLK8WpIE@db.fulvllyekwrzwphqenak.supabase.co:5432/postgres?sslmode=require',
  
  // Pooler session with project ref in username
  'postgresql://postgres.fulvllyekwrzwphqenak:0VnSw8grsLK8WpIE@aws-0-us-east-1.pooler.supabase.com:5432/postgres?pgbouncer=true',
  
  // Pooler transaction with project ref in username
  'postgresql://postgres.fulvllyekwrzwphqenak:0VnSw8grsLK8WpIE@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
  
  // Pooler session with just postgres user
  'postgresql://postgres:0VnSw8grsLK8WpIE@aws-0-us-east-1.pooler.supabase.com:5432/postgres?pgbouncer=true',
  
  // Pooler transaction with just postgres user
  'postgresql://postgres:0VnSw8grsLK8WpIE@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true',
  
  // Pooler with application_name
  'postgresql://postgres:0VnSw8grsLK8WpIE@aws-0-us-east-1.pooler.supabase.com:5432/postgres?pgbouncer=true&application_name=fulvllyekwrzwphqenak',
];

async function testConnection(connStr, name) {
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  
  try {
    await client.connect();
    const result = await client.query('SELECT version()');
    console.log(`✅ ${name}: SUCCESS`);
    console.log(`   Version: ${result.rows[0].version.substring(0, 50)}...`);
    await client.end();
    return true;
  } catch (err) {
    console.log(`❌ ${name}: FAILED`);
    console.log(`   Error: ${err.message}`);
    return false;
  }
}

async function main() {
  console.log('Testing Supabase connections...\n');
  
  for (let i = 0; i < connectionStrings.length; i++) {
    const name = `Connection ${i + 1}`;
    await testConnection(connectionStrings[i], name);
    console.log('');
  }
}

main().catch(console.error);
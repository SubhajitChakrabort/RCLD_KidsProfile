const { pool } = require('./config/db');

async function testProfiles() {
  try {
    console.log('🔍 Testing database connection and profiles...');
    
    // Test database connection
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    
    // Check if users table has any profiles
    const [users] = await connection.execute('SELECT id, profile_id, name FROM users LIMIT 5');
    console.log('📊 Users in database:', users);
    
    // Check if any profiles have profile_id
    const [profilesWithId] = await connection.execute('SELECT id, profile_id, name FROM users WHERE profile_id IS NOT NULL LIMIT 5');
    console.log('🆔 Profiles with profile_id:', profilesWithId);
    
    connection.release();
    
    if (profilesWithId.length === 0) {
      console.log('⚠️ No profiles with profile_id found. You may need to create a new profile.');
    } else {
      console.log('✅ Found profiles with profile_id. You can test with one of these IDs.');
    }
    
  } catch (error) {
    console.error('❌ Error testing profiles:', error);
  }
  
  process.exit(0);
}

testProfiles(); 
const mysql = require('mysql2/promise');

// Create a connection pool to your InfinityFree database
const pool = mysql.createPool({
  host: 'sql312.infinityfree.com',    // your DB host
  user: 'if0_40093677',               // your DB username
  password: 'f4H784tvZuL2',           // your DB password
  database: 'if0_40093677_keyauth',   // your DB name
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;

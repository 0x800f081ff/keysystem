const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: 'caboose.proxy.rlwy.net',     // Railway host
  user: 'root',                        // Railway username
  password: 'jIpgGOwptNDwzkJTxdQsdlvBQjUQbOWM',  // Railway password
  database: 'railway',                 // Railway database name
  port: 30323,                         // Railway port
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = pool;

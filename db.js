const pool = mysql.createPool({
  host: process.env.host,
  user: process.env.user,
  password: process.env.password,
  database: process.env.database,
  port: process.env.port ? parseInt(process.env.port) : 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

const mysql = require("mysql2");

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "medical_db",
  port: 3306, 
  waitForConnections: true,
  connectionLimit: 10 ,
  queueLimit: 0
});

db.getConnection((err, connection) => {
  if (err) {
    console.error("❌ Database connection failed:", err);
  } else {
    console.log("✅ MySQL Database Connected Successfully");
    connection.release();
  }
});

module.exports = db.promise();


// const mysql = require("mysql2");

// const db = mysql.createPool({
//   host: "localhost",
//   user: "root",
//   password: "",
//   database: "medical_db",
//   port: 3306,
//   waitForConnections: true,
//   connectionLimit: 10 ,
//   queueLimit: 0
// });

// db.getConnection((err, connection) => {
//   if (err) {
//     console.error("❌ Database connection failed:", err);
//   } else {
//     console.log("✅ MySQL Database Connected Successfully");
//     connection.release();
//   }
// });

// module.exports = db.promise();

const mysql = require("mysql2");
require("dotenv").config();

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,

  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
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

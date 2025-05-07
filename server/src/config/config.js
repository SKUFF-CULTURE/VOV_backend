require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  db: {
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:123@localhost:5434/vov'
  }
};

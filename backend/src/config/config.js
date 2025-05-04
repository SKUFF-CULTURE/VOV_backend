require('dotenv/lib/main').config();

module.exports = {
  port: process.env.PORT || 5000,
  db: {
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:123@localhost:5432/VOV'
  }
};

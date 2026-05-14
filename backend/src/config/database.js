const mongoose = require('mongoose');

/**
 * MongoDB connection helper.
 *
 * Exports a `connect()` function that the server calls at startup, plus the
 * `mongoose` instance so callers can use ObjectId / Types directly.
 */

mongoose.set('strictQuery', true);

async function connect() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/resculance';
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: parseInt(process.env.DB_CONNECT_TIMEOUT_MS, 10) || 10000,
    maxPoolSize: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10
  });
  return mongoose.connection;
}

mongoose.connection.on('connected', () => {
  console.log('✅ MongoDB connected:', mongoose.connection.host + '/' + mongoose.connection.name);
});

mongoose.connection.on('error', (err) => {
  console.error('MongoDB connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
});

module.exports = {
  connect,
  mongoose,
  connection: mongoose.connection
};

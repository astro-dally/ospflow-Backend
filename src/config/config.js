const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3001,
  mongoURI: process.env.MONGO_URI,
  jwtSecret: process.env.JWT_SECRET,
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '20m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '20d',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760, // 10MB in bytes
  email: {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    username: process.env.EMAIL_USERNAME,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM,
  },
  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD || '',
  },
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
};
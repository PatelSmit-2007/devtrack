import dotenv from 'dotenv';

dotenv.config();

if (!process.env.TEST_DATABASE_URL) {
  throw new Error('TEST_DATABASE_URL is not defined');
}

process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

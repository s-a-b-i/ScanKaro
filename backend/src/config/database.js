import mongoose from 'mongoose';
import dns from 'dns';

import { env, isProduction } from './env.js';

mongoose.set('strictQuery', true);

export async function connectDatabase() {
  // Some Windows DNS setups cause Node's c-ares SRV lookups to fail with ECONNREFUSED.
  // In development override the DNS servers to known public resolvers so SRV queries succeed.
  if (!isProduction) {
    try {
      dns.setServers(['8.8.8.8', '1.1.1.1']);
      console.log('[dns] using public resolvers: 8.8.8.8, 1.1.1.1');
    } catch (err) {
      console.warn('[dns] could not set DNS servers:', err?.message ?? String(err));
    }
  }

  const options = {
    maxPoolSize: isProduction ? 50 : 10,
    minPoolSize: isProduction ? 5 : 1,
    serverSelectionTimeoutMS: 10_000,
    socketTimeoutMS: 45_000,
    autoIndex: !isProduction,
  };

  mongoose.connection.on('connected', () => {
    console.log('[mongodb] connected');
  });

  mongoose.connection.on('error', (error) => {
    console.error('[mongodb] connection error:', error.message);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[mongodb] disconnected');
  });

  await mongoose.connect(env.MONGODB_URI, options);
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}

export { mongoose };

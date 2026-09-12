import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { testConnection } from './services/supabase';
import { sessionRoutes } from './routes/session';
import { voiceRoutes } from './routes/voice';
import { inventoryRoutes } from './routes/inventory';
import multipart from '@fastify/multipart';

dotenv.config();

const app = Fastify({ logger: true });

app.register(cors, {
  origin: process.env.KIOSK_URL || 'http://localhost:3000',
});

app.register(multipart);

app.get('/health', async () => {
  return { 
    status: 'ok', 
    service: 'Relay Backend',
    timestamp: new Date() 
  };
});

app.register(sessionRoutes);
app.register(voiceRoutes);
app.register(inventoryRoutes);
const start = async () => {
  try {
    await testConnection();
    const port = parseInt(process.env.PORT || '3001', 10);
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Relay Backend running on http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
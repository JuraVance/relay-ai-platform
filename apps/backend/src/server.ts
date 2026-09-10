import Fastify from 'fastify';
import cors from '@fastify/cors';
import dotenv from 'dotenv';

dotenv.config();

const app = Fastify({
  logger: true,
});

app.register(cors, {
  origin: process.env.KIOSK_URL || 'http://localhost:3000',
});

// Health check
app.get('/health', async () => {
  return { 
    status: 'ok', 
    service: 'Relay Backend',
    timestamp: new Date() 
  };
});

// Start
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3001', 10);
    await app.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Relay Backend running on http://localhost:${port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
};

start();
import { FastifyInstance } from 'fastify';
import { EdealerAdapter } from '../adapters/inventory/edealer';

export const inventoryRoutes = async (app: FastifyInstance) => {

  // Trigger manual sync
  app.post('/api/inventory/sync', async (request, reply) => {
    try {
      const { dealerId } = request.body as { dealerId: string };
      
      if (!dealerId) {
        return reply.status(400).send({ error: 'dealerId required' });
      }

      const adapter = new EdealerAdapter();
      const result = await adapter.sync(dealerId);

      return reply.send({
        success: true,
        result,
      });

    } catch (err: any) {
      console.error('❌ Sync error:', err.message);
      return reply.status(500).send({ 
        success: false,
        error: err.message 
      });
    }
  });

  // Get vehicles
  app.get('/api/inventory/:dealerId', async (request, reply) => {
    try {
      const { dealerId } = request.params as { dealerId: string };
      const adapter = new EdealerAdapter();
      const vehicles = await adapter.getVehicles(dealerId);

      return reply.send({
        success: true,
        count: vehicles.length,
        vehicles,
      });

    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
};
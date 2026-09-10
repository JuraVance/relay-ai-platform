import { FastifyInstance } from 'fastify';
import { RelayOrchestrator } from '../orchestrator/index';

export const sessionRoutes = async (app: FastifyInstance) => {

  // Start a new session
  app.post('/api/sessions', async (request, reply) => {
    try {
      const dealerId = process.env.DEALER_ID!;
      const orchestrator = new RelayOrchestrator(dealerId);

      const body = request.body as {
        kioskId?: string;
        language?: string;
        customerPhone?: string;
      };

      const state = await orchestrator.startSession({
        kioskId: body.kioskId || 'kiosk-1',
        language: body.language || 'en',
        customerPhone: body.customerPhone,
      });

      return reply.send({
        success: true,
        sessionId: state.sessionId,
        stage: state.currentStage,
        state,
      });

    } catch (err: any) {
      console.error('Session error:', err);
      return reply.status(500).send({ 
        success: false, 
        error: err.message 
      });
    }
  });

  // Process customer input
  app.post('/api/sessions/:sessionId/message', async (request, reply) => {
    try {
      const { sessionId } = request.params as { sessionId: string };
      const { text, state } = request.body as { text: string; state: any };

      const dealerId = process.env.DEALER_ID!;
      const orchestrator = new RelayOrchestrator(dealerId);

      const result = await orchestrator.processInput(state, text);

      return reply.send({
        success: true,
        response: result.response,
        state: result.updatedState,
      });

    } catch (err: any) {
      console.error('Message error:', err);
      return reply.status(500).send({ 
        success: false, 
        error: err.message 
      });
    }
  });
};
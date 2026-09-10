import { FastifyInstance } from 'fastify';
import { synthesizeSpeech } from '../services/voice';
import { RelayOrchestrator } from '../orchestrator/index';

export const voiceRoutes = async (app: FastifyInstance) => {

  // TTS: Convert Relay text response to audio
  app.post('/api/voice/speak', async (request, reply) => {
    try {
      const { text, voiceId } = request.body as { 
        text: string; 
        voiceId?: string 
      };

      const audioBuffer = await synthesizeSpeech(text, voiceId);

      return reply
        .header('Content-Type', 'audio/mpeg')
        .header('Content-Length', audioBuffer.length)
        .send(audioBuffer);

    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // SPEAK + PROCESS: Full voice round trip
  app.post('/api/voice/conversation', async (request, reply) => {
    try {
      const { text, state, voiceId } = request.body as {
        text: string;
        state: any;
        voiceId?: string;
      };

      const dealerId = process.env.DEALER_ID!;
      const orchestrator = new RelayOrchestrator(dealerId);

      // Get Relay text response
      const result = await orchestrator.processInput(state, text);

      // Convert to audio
      const audioBuffer = await synthesizeSpeech(result.response, voiceId);
      const audioBase64 = audioBuffer.toString('base64');

      return reply.send({
        success: true,
        response: result.response,
        audio: audioBase64,
        state: result.updatedState,
      });

    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });
};
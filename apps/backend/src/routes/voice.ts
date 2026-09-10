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

    // STT: Accept audio form upload + transcribe
  app.post('/api/voice/transcribe-form', async (request, reply) => {
    try {
      const data = await request.file();
      if (!data) return reply.status(400).send({ error: 'No audio file' });

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) {
        chunks.push(chunk);
      }
      const audioBuffer = Buffer.concat(chunks);
      const language = (request.query as any).language || 'en';

      const { transcribeAudio } = await import('../services/voice');
      const result = await transcribeAudio(audioBuffer, language);

      return reply.send({
        success: true,
        text: result.text,
        confidence: result.confidence,
      });

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
import { FastifyInstance } from 'fastify';
import { synthesizeSpeech, transcribeAudio } from '../services/voice';
import { RelayOrchestrator } from '../orchestrator/index';

export const voiceRoutes = async (app: FastifyInstance) => {

  // TTS: Text to speech
  app.post('/api/voice/speak', async (request, reply) => {
    try {
      const { text, voiceId } = request.body as { text: string; voiceId?: string };
      const audioBuffer = await synthesizeSpeech(text, voiceId);
      return reply
        .header('Content-Type', 'audio/mpeg')
        .send(audioBuffer);
    } catch (err: any) {
      return reply.status(500).send({ error: err.message });
    }
  });

  // STT: Audio file to text
  app.post('/api/voice/transcribe-form', async (request, reply) => {
    try {
      const parts = request.parts();
      let audioBuffer: Buffer | null = null;
      let language = 'en';

      for await (const part of parts) {
        if (part.type === 'file') {
          const chunks: Buffer[] = [];
          for await (const chunk of part.file) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          }
          audioBuffer = Buffer.concat(chunks);
        } else if (part.type === 'field' && part.fieldname === 'language') {
          language = part.value as string;
        }
      }

      if (!audioBuffer || audioBuffer.length === 0) {
        return reply.status(400).send({ error: 'No audio received' });
      }

      console.log(`🎤 Transcribing ${audioBuffer.length} bytes, language: ${language}`);

      const result = await transcribeAudio(audioBuffer, language);

      console.log(`📝 Transcript: "${result.text}" (confidence: ${result.confidence})`);

      return reply.send({
        success: true,
        text: result.text,
        confidence: result.confidence,
      });

    } catch (err: any) {
      console.error('❌ Transcribe error FULL:', err);
      return reply.status(500).send({ error: err.message });
    }
  });

  // Full conversation round trip
  app.post('/api/voice/conversation', async (request, reply) => {
    try {
      const { text, state, voiceId } = request.body as {
        text: string;
        state: any;
        voiceId?: string;
      };

      const dealerId = process.env.DEALER_ID!;
      const orchestrator = new RelayOrchestrator(dealerId);
      const result = await orchestrator.processInput(state, text);
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
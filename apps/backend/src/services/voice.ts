// ============================================================
// RELAY VOICE SERVICE
// Vendor agnostic STT + TTS
// Swap any provider via STT_PROVIDER + TTS_PROVIDER in .env
// Providers: deepgram | grok | elevenlabs | azure | google
// ============================================================

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });

// ============================================================
// INTERFACES
// ============================================================

export interface STTProvider {
  transcribe(audioBuffer: Buffer, language?: string): Promise<{ text: string; confidence: number }>;
}

export interface TTSProvider {
  synthesize(text: string, voiceId?: string): Promise<Buffer>;
}

// ============================================================
// STT PROVIDERS
// ============================================================

class DeepgramSTT implements STTProvider {
  async transcribe(audioBuffer: Buffer, language = 'en') {
    try {
      const { DeepgramClient } = require('@deepgram/sdk');
      const client = new DeepgramClient(process.env.DEEPGRAM_API_KEY!);
      const response = await client.listen.prerecorded.transcribeFile(
        audioBuffer,
        {
          model: 'nova-2',
          language,
          smart_format: true,
          punctuate: true,
        }
      );
      const alt = response?.result?.results?.channels[0]?.alternatives[0];
      return {
        text: alt?.transcript || '',
        confidence: alt?.confidence || 0,
      };
    } catch (err: any) {
      console.error('❌ Deepgram error:', err.message);
      return { text: '', confidence: 0 };
    }
  }
}

class GrokSTT implements STTProvider {
  async transcribe(audioBuffer: Buffer, language = 'en') {
    try {
      const FormData = require('form-data');
      const form = new FormData();
      form.append('file', audioBuffer, {
        filename: 'audio.webm',
        contentType: 'audio/webm',
      });
      form.append('model', 'whisper-large-v3');
      form.append('language', language);
      form.append('response_format', 'json');

      const response = await fetch('https://api.x.ai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROK_API_KEY}`,
          ...form.getHeaders(),
        },
        body: form,
      });

      console.log('Grok STT status:', response.status);
      const responseText = await response.text();
      console.log('Grok STT response:', responseText);

      if (!response.ok) throw new Error(responseText);
      const data = JSON.parse(responseText) as { text: string };
      return { text: data.text || '', confidence: 0.95 };

    } catch (err: any) {
      console.error('❌ Grok STT error:', err.message);
      return { text: '', confidence: 0 };
    }
  }
}

class ElevenLabsSTT implements STTProvider {
  async transcribe(audioBuffer: Buffer, language = 'en') {
    try {
      const FormData = require('form-data');
      const form = new FormData();
      form.append('file', audioBuffer, {
        filename: 'audio.webm',
        contentType: 'audio/webm',
      });
      form.append('model_id', 'scribe_v1');

      const response = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY!,
          ...form.getHeaders(),
        },
        body: form,
      });

      console.log('ElevenLabs STT status:', response.status);
      const responseText = await response.text();
      console.log('ElevenLabs STT response:', responseText);

      if (!response.ok) throw new Error(responseText);
      const data = JSON.parse(responseText) as { text: string };
      return { text: data.text || '', confidence: 0.95 };

    } catch (err: any) {
      console.error('❌ ElevenLabs STT error:', err.message);
      return { text: '', confidence: 0 };
    }
  }
}

// ============================================================
// TTS PROVIDERS
// ============================================================

class ElevenLabsTTS implements TTSProvider {
  async synthesize(text: string, voiceId?: string): Promise<Buffer> {
    const voice = voiceId || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice}/stream`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'xi-api-key': process.env.ELEVENLABS_API_KEY!,
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_turbo_v2',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.3,
              use_speaker_boost: true,
            },
          }),
        }
      );
      if (!response.ok) throw new Error(response.statusText);
      return Buffer.from(await response.arrayBuffer());
    } catch (err: any) {
      console.error('❌ ElevenLabs TTS error:', err.message);
      return Buffer.alloc(0);
    }
  }
}

class GrokTTS implements TTSProvider {
  async synthesize(text: string, voiceId?: string): Promise<Buffer> {
    console.log('Grok TTS: falling back to ElevenLabs');
    return new ElevenLabsTTS().synthesize(text, voiceId);
  }
}

// ============================================================
// FACTORY
// ============================================================

const getSTTProvider = (): STTProvider => {
  const provider = process.env.STT_PROVIDER || 'elevenlabs';
  console.log('🎤 STT Provider selected:', provider);
  switch (provider.toLowerCase()) {
    case 'grok':       return new GrokSTT();
    case 'deepgram':   return new DeepgramSTT();
    case 'elevenlabs':
    default:           return new ElevenLabsSTT();
  }
};

const getTTSProvider = (): TTSProvider => {
  const provider = process.env.TTS_PROVIDER || 'elevenlabs';
  console.log('🔊 TTS Provider selected:', provider);
  switch (provider.toLowerCase()) {
    case 'grok':       return new GrokTTS();
    case 'elevenlabs':
    default:           return new ElevenLabsTTS();
  }
};

// ============================================================
// PUBLIC API
// ============================================================

export const transcribeAudio = async (
  audioBuffer: Buffer,
  language?: string
): Promise<{ text: string; confidence: number }> => {
  return getSTTProvider().transcribe(audioBuffer, language);
};

export const synthesizeSpeech = async (
  text: string,
  voiceId?: string
): Promise<Buffer> => {
  return getTTSProvider().synthesize(text, voiceId);
};
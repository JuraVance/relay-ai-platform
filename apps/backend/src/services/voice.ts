// ============================================================
// RELAY VOICE SERVICE
// Vendor agnostic STT + TTS
// Swap any provider via VOICE_STT_PROVIDER + VOICE_TTS_PROVIDER in .env
// Providers: deepgram | grok | elevenlabs | azure | google
// ============================================================

import dotenv from 'dotenv';
dotenv.config();

// ============================================================
// INTERFACES (The contract — providers must implement these)
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
    const sdk = require('@deepgram/sdk');
    const client = sdk.createClient
      ? sdk.createClient(process.env.DEEPGRAM_API_KEY!)
      : new sdk.Deepgram(process.env.DEEPGRAM_API_KEY!);

    try {
      const response = await client.listen.prerecorded.transcribeFile(audioBuffer, {
        model: 'nova-2',
        language,
        smart_format: true,
        punctuate: true,
      });
      const alt = response?.result?.results?.channels[0]?.alternatives[0];
      return { text: alt?.transcript || '', confidence: alt?.confidence || 0 };
    } catch {
      return { text: '', confidence: 0 };
    }
  }
}

class GrokSTT implements STTProvider {
  async transcribe(audioBuffer: Buffer, language = 'en') {
    // Grok STT integration — swap in when ready
    console.log('Grok STT: not yet implemented, falling back');
    return { text: '', confidence: 0 };
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
    // Grok TTS integration — swap in when ready
    console.log('Grok TTS: not yet implemented, falling back to ElevenLabs');
    return new ElevenLabsTTS().synthesize(text, voiceId);
  }
}

// ============================================================
// FACTORY: Pick provider from .env
// STT_PROVIDER=deepgram | grok
// TTS_PROVIDER=elevenlabs | grok
// ============================================================

const getSTTProvider = (): STTProvider => {
  switch ((process.env.STT_PROVIDER || 'deepgram').toLowerCase()) {
    case 'grok':    return new GrokSTT();
    case 'deepgram':
    default:        return new DeepgramSTT();
  }
};

const getTTSProvider = (): TTSProvider => {
  switch ((process.env.TTS_PROVIDER || 'elevenlabs').toLowerCase()) {
    case 'grok':       return new GrokTTS();
    case 'elevenlabs':
    default:           return new ElevenLabsTTS();
  }
};

// ============================================================
// PUBLIC API (What the rest of Relay uses)
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
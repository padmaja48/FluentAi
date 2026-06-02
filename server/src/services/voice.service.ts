import { env } from '../config/env';

export type VoiceStyle = 'default' | 'professional_female' | 'professional_male' | 'neutral';

export const getPersonaVoiceStyle = (personaId: string): VoiceStyle => {
  const map: Record<string, VoiceStyle> = {
    'us-american': 'professional_male',
    'us-indian': 'professional_male',
    'us-australian': 'neutral',
    'ru-russian': 'professional_male',
  };
  return map[personaId] ?? 'default';
};

const resolveVoiceId = (voiceStyle: VoiceStyle = 'default') => {
  const voiceMap: Record<VoiceStyle, string | undefined> = {
    default: env.ELEVENLABS_VOICE_ID,
    professional_female: env.ELEVENLABS_PROFESSIONAL_FEMALE_VOICE_ID,
    professional_male: env.ELEVENLABS_PROFESSIONAL_MALE_VOICE_ID,
    neutral: env.ELEVENLABS_NEUTRAL_VOICE_ID,
  };

  return voiceMap[voiceStyle] ?? env.ELEVENLABS_VOICE_ID;
};

export const synthesizeSpeech = async (text: string, voiceStyle: VoiceStyle = 'default') => {
  if (!env.ELEVENLABS_API_KEY) {
    return {
      audioBase64: Buffer.from(`AI interviewer says: ${text}`).toString('base64'),
      contentType: 'text/plain',
    };
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${resolveVoiceId(voiceStyle)}`, {
    method: 'POST',
    headers: {
      'xi-api-key': env.ELEVENLABS_API_KEY,
      'content-type': 'application/json',
      accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs request failed with ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return {
    audioBase64: Buffer.from(arrayBuffer).toString('base64'),
    contentType: response.headers.get('content-type') ?? 'audio/mpeg',
  };
};

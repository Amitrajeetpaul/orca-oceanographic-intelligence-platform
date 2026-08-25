// Sends recorded audio to Groq's hosted Whisper model for transcription.
//
// Pure auto-detection (no language hint) sounds ideal, but real-world
// audio — background noise, a short phrase, an average phone mic — gives
// Whisper's language-ID step far less signal than a clean clip, and it
// measurably mixes up related scripts/languages under those conditions
// (confirmed in testing, and reported by real usage: Bengali coming back
// in the wrong script). Passing a `language` hint skips that guessing
// step entirely and transcribes directly in the given language, which is
// dramatically more reliable — the same tradeoff production voice apps
// make. We use the user's saved profile language as that hint by default,
// falling back to true auto-detect only when none is set.
export interface TranscriptionResult {
  text: string;
  language: string | null;
}

// The full-accuracy model, not the faster "turbo" variant — turbo trades
// away multilingual/language-ID accuracy for speed, and that accuracy is
// exactly what matters for short Indic-language utterances (confirmed by
// testing: turbo misidentified a Bengali sample as Gujarati).
const GROQ_WHISPER_MODEL = 'whisper-large-v3';

function extensionForContentType(contentType: string): string {
  if (contentType.includes('webm')) return 'webm';
  if (contentType.includes('mp4') || contentType.includes('m4a')) return 'mp4';
  if (contentType.includes('mpeg') || contentType.includes('mp3')) return 'mp3';
  if (contentType.includes('wav')) return 'wav';
  if (contentType.includes('ogg')) return 'ogg';
  return 'webm';
}

// Whisper's ISO-639-1 codes for the languages we support — our LanguageCode
// values already match these directly (en, hi, ta, te, ml, kn, bn, gu, mr, or).
const SUPPORTED_WHISPER_LANGUAGES = new Set(['en', 'hi', 'ta', 'te', 'ml', 'kn', 'bn', 'gu', 'mr', 'or']);

export async function transcribeAudio(audio: Buffer, contentType: string, languageHint?: string): Promise<TranscriptionResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('Voice transcription is not configured.');
  if (!audio || audio.length === 0) throw new Error('No audio received.');

  const form = new FormData();
  const ext = extensionForContentType(contentType);
  form.append('file', new Blob([audio], { type: contentType }), `audio.${ext}`);
  form.append('model', GROQ_WHISPER_MODEL);
  form.append('response_format', 'verbose_json');
  if (languageHint && SUPPORTED_WHISPER_LANGUAGES.has(languageHint)) {
    form.append('language', languageHint);
  }

  const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Groq transcription failed (${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return { text: (data.text || '').trim(), language: data.language || null };
}

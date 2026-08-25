// Sends recorded audio to Groq's hosted Whisper model for transcription.
// Whisper natively auto-detects the spoken language, so unlike the
// browser's Web Speech API (which requires picking one language upfront
// and mangles anything spoken in a different one — a real bug we hit
// where a Bengali voice query came out as garbled English text), this
// actually understands whatever language the user speaks, matching how
// voice input works in ChatGPT and similar assistants.
export interface TranscriptionResult {
  text: string;
  language: string | null;
}

const GROQ_WHISPER_MODEL = 'whisper-large-v3-turbo';

function extensionForContentType(contentType: string): string {
  if (contentType.includes('webm')) return 'webm';
  if (contentType.includes('mp4') || contentType.includes('m4a')) return 'mp4';
  if (contentType.includes('mpeg') || contentType.includes('mp3')) return 'mp3';
  if (contentType.includes('wav')) return 'wav';
  if (contentType.includes('ogg')) return 'ogg';
  return 'webm';
}

export async function transcribeAudio(audio: Buffer, contentType: string): Promise<TranscriptionResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('Voice transcription is not configured.');
  if (!audio || audio.length === 0) throw new Error('No audio received.');

  const form = new FormData();
  const ext = extensionForContentType(contentType);
  form.append('file', new Blob([audio], { type: contentType }), `audio.${ext}`);
  form.append('model', GROQ_WHISPER_MODEL);
  form.append('response_format', 'verbose_json');
  // No `language` param — this is the whole point: let Whisper detect it
  // rather than forcing whatever the UI's language picker happens to be set to.

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

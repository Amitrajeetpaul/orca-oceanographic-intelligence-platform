import { LanguageCode } from '../types';

export interface LanguageOption {
  code: LanguageCode;
  label: string;
  /** BCP-47 tag for the Web Speech API (SpeechRecognition / SpeechSynthesis). */
  speechCode: string;
}

// Covers English plus the major languages of India's coastal states, so
// voice input/output and AI responses can match whichever the user picks.
export const LANGUAGES: LanguageOption[] = [
  { code: 'en', label: 'English', speechCode: 'en-IN' },
  { code: 'hi', label: 'हिन्दी', speechCode: 'hi-IN' },
  { code: 'ta', label: 'தமிழ்', speechCode: 'ta-IN' },
  { code: 'te', label: 'తెలుగు', speechCode: 'te-IN' },
  { code: 'ml', label: 'മലയാളം', speechCode: 'ml-IN' },
  { code: 'kn', label: 'ಕನ್ನಡ', speechCode: 'kn-IN' },
  { code: 'bn', label: 'বাংলা', speechCode: 'bn-IN' },
  { code: 'gu', label: 'ગુજરાતી', speechCode: 'gu-IN' },
  { code: 'mr', label: 'मराठी', speechCode: 'mr-IN' },
  { code: 'or', label: 'ଓଡ଼ିଆ', speechCode: 'or-IN' },
];

export function resolveLanguage(code: LanguageCode): LanguageOption {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

// Unicode-script-range detection for a piece of *response* text — used to
// pick the right voice for text-to-speech regardless of which language was
// selected in the picker (the AI auto-detects and replies in whatever
// language the question was asked in, which may differ from the picker).
const SCRIPT_RANGES: [LanguageCode, RegExp][] = [
  ['hi', /[ऀ-ॿ]/], // Devanagari (Hindi/Marathi share this — default to Hindi)
  ['ta', /[஀-௿]/],
  ['te', /[ఀ-౿]/],
  ['ml', /[ഀ-ൿ]/],
  ['kn', /[ಀ-೿]/],
  ['bn', /[ঀ-৿]/],
  ['gu', /[઀-૿]/],
  ['or', /[଀-୿]/],
];

export function detectScriptLanguage(text: string): LanguageCode {
  for (const [code, range] of SCRIPT_RANGES) {
    if (range.test(text)) return code;
  }
  return 'en';
}

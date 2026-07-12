export interface TTSVoice {
  id: string;
  name: string;
  description: string | null;
  language: string;
  voiceType: string;
  engine: string | null;
  sampleCount: number;
}

export interface TTSGenerateOptions {
  id: string;
  jobId: string;
  text: string;
  voiceId: string;
  language?: string;
}

export interface TTSGenerateResult {
  duration: number;
  filename: string;
}

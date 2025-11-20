
export interface Attachment {
  type: 'image' | 'pdf' | 'text';
  mimeType: string;
  data?: string; // Base64 for images/pdf
  textContent?: string; // Extracted text for docx/txt
  name: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  attachment?: Attachment;
  isError?: boolean;
  timestamp: number;
  feedback?: 'up' | 'down';
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
  input: string;
  selectedAttachment: Attachment | null;
}

export type ModelName = 'gemini-2.5-flash';

// Add global type definitions for external libraries and browser APIs
declare global {
  interface Window {
    mammoth: any;
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

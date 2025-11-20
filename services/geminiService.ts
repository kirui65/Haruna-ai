import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { Message, Attachment } from '../types';

// Use process.env.API_KEY as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const MODEL_NAME = 'gemini-2.5-flash';

/**
 * Converts the internal message format to the Gemini API content format.
 */
const formatHistory = (messages: Message[]) => {
  return messages.map((msg) => {
    const parts: any[] = [];
    
    // Handle Attachments
    if (msg.attachment) {
      if (msg.attachment.type === 'image' || msg.attachment.type === 'pdf') {
        // Extract base64 data (remove data:xxx;base64, prefix if present)
        const base64Data = msg.attachment.data?.split(',')[1] || msg.attachment.data;
        if (base64Data) {
          parts.push({
            inlineData: {
              mimeType: msg.attachment.mimeType,
              data: base64Data,
            },
          });
        }
      } else if (msg.attachment.type === 'text' && msg.attachment.textContent) {
        // Inject text content from DOCX/TXT directly into the prompt parts
        parts.push({ text: `[Attached Document Content: ${msg.attachment.name}]\n${msg.attachment.textContent}\n[End of Document]\n` });
      }
    }

    // Add text
    if (msg.text) {
      parts.push({ text: msg.text });
    }

    return {
      role: msg.role,
      parts: parts,
    };
  });
};

export async function* streamGeminiResponse(
  history: Message[],
  currentPrompt: string,
  currentAttachment: Attachment | null
) {
  if (!process.env.API_KEY) {
    yield "Error: API Key is missing. Please configure process.env.API_KEY.";
    return;
  }

  // Construct the full history for the API
  const previousContent = formatHistory(history);
  
  const currentParts: any[] = [];
  
  if (currentAttachment) {
    if (currentAttachment.type === 'image' || currentAttachment.type === 'pdf') {
      const base64Data = currentAttachment.data?.split(',')[1] || currentAttachment.data;
      if (base64Data) {
        currentParts.push({
          inlineData: {
            mimeType: currentAttachment.mimeType,
            data: base64Data
          }
        });
      }
    } else if (currentAttachment.type === 'text' && currentAttachment.textContent) {
      currentParts.push({ text: `[Attached Document Content: ${currentAttachment.name}]\n${currentAttachment.textContent}\n[End of Document]\n` });
    }
  }
  
  if (currentPrompt) {
    currentParts.push({ text: currentPrompt });
  }

  const newContent = {
      role: 'user',
      parts: currentParts
  };

  const contents = [...previousContent, newContent];

  const responseStream = await ai.models.generateContentStream({
    model: MODEL_NAME,
    contents: contents,
    config: {
      systemInstruction: `You are Haruna AI, an advanced multimodal AI tutor and document assistant.

Your Capabilities:
1. **Document Repair & Editing**: You can analyze uploaded documents (PDF, DOCX, Text). If asked to "repair" or "fix" them, identify grammatical errors, structural issues, or clarity problems and provide the **corrected text** clearly.
2. **Design Analysis**: If a user uploads an ID card, Passport, or design document and asks for edits, **DO NOT** attempt to forge a new image. Instead, analyze the design, suggest layout improvements, or critique the typography and aesthetics for educational/design purposes.
3. **Visual Analysis**: You can read text (OCR), interpret complex diagrams, math formulas, and recognize objects in images.
4. **General Teaching**: Break down problems into clear, logical steps.

Safety Guidelines:
- If asked to create a fake ID or falsify a government document, strictly REFUSE.
- You can, however, analyze the *design elements* of an ID (like font, spacing, color) if the request is for "design only" or educational purposes.
- When "editing" a document, output the corrected content in Markdown format so the user can copy it.

Formatting:
- Use **bold** for key corrections.
- Use code blocks for code or large text excerpts.
- Be concise and helpful.`,
    }
  });

  for await (const chunk of responseStream) {
    const c = chunk as GenerateContentResponse;
    if (c.text) {
      yield c.text;
    }
  }
}
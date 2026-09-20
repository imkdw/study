import { GoogleGenAI } from "@google/genai";
import { CONFIGS } from "./config.ts";

const ai = new GoogleGenAI({
  apiKey: CONFIGS.GEMINI_API_KEY,
});

async function getCompletion(prompt: string, systemInstruction = "", prefill = "") {
  const response = await ai.models.generateContent({
    model: CONFIGS.MODEL,
    contents: [
      { role: "user", parts: [{ text: prompt }] },
      ...(prefill ? [{ role: "model" as const, parts: [{ text: prefill }] }] : []),
    ],
    config: {
      maxOutputTokens: 2000,
      temperature: 0,
      ...(systemInstruction ? { systemInstruction } : {}),
    },
  });
  return response.text ?? "";
}

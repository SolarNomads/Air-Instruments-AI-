import { GoogleGenAI, Type } from "@google/genai";
import { InstrumentState, Waveform, DEFAULT_NOTES, DEFAULT_CONFIG } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateInstrumentConfig = async (prompt: string): Promise<InstrumentState> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate a synthesizer configuration and musical scale based on this mood/description: "${prompt}". 
      If the user asks for a specific scale (like Pentatonic, Blues, Chromatic), ensure the notes array reflects that.
      The notes should span roughly 2 octaves (e.g. C4 to C6).
      There should be exactly 12 notes in the array.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "Creative name for this preset" },
            description: { type: Type.STRING, description: "Short explanation of the sound design" },
            notes: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING },
              description: "Array of 12 musical notes (e.g., 'C4', 'D#4')"
            },
            config: {
              type: Type.OBJECT,
              properties: {
                waveform: { type: Type.STRING, enum: [Waveform.SINE, Waveform.SQUARE, Waveform.SAWTOOTH, Waveform.TRIANGLE] },
                attack: { type: Type.NUMBER, description: "0.001 to 2.0" },
                decay: { type: Type.NUMBER, description: "0.01 to 2.0" },
                sustain: { type: Type.NUMBER, description: "0.0 to 1.0" },
                release: { type: Type.NUMBER, description: "0.1 to 5.0" },
                gain: { type: Type.NUMBER, description: "Master volume 0.1 to 0.5" },
                filterFreq: { type: Type.NUMBER, description: "200 to 10000 Hz" },
                delayMix: { type: Type.NUMBER, description: "0.0 to 0.8" }
              },
              required: ["waveform", "attack", "decay", "sustain", "release", "gain", "filterFreq", "delayMix"]
            }
          },
          required: ["name", "notes", "config", "description"]
        }
      }
    });

    if (response.text) {
      const generated = JSON.parse(response.text);
      return {
        ...generated,
        id: `gen-${Date.now()}`,
        color: 'fuchsia'
      } as InstrumentState;
    }
    throw new Error("No response from Gemini");

  } catch (error) {
    console.error("Gemini Generation Error:", error);
    // Fallback
    return {
      id: "fallback-default",
      color: "cyan",
      name: "Default Harp",
      description: "Gemini couldn't be reached, using default settings.",
      notes: DEFAULT_NOTES,
      config: DEFAULT_CONFIG
    };
  }
};
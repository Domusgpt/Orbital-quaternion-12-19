
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

export const generateTurntableGrid = async (
  productName: string,
  frontImageBase64: string,
  backImageBase64: string | null
): Promise<string> => {
  // Create a fresh instance right before the call to ensure the latest API key is used
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const frontData = frontImageBase64.split(',')[1];
  const backData = backImageBase64 ? backImageBase64.split(',')[1] : null;

  const mode = backData ? "BIPOLAR_REFERENCE_SYNC" : "MONOPOLAR_HEURISTIC_RECONSTRUCTION";
  
  const prompt = `
    CRITICAL OBJECTIVE: Generate a high-fidelity 8-frame product turntable sprite sheet for "${productName}".
    ENGINE_MODE: ${mode}

    TECHNICAL SPECIFICATIONS:
    1. GRID ARCHITECTURE: Exactly 4 columns by 2 rows (4x2). Total 8 segments.
    2. SPATIAL LOCK: The object MUST maintain identical pixel-scale, vertical alignment, and centroid positioning across ALL 8 frames. No bouncing, shifting, or resizing.
    3. ROTATION LOGIC (Y-AXIS):
       - [ROW 1]: 0° (Front), 45°, 90° (Right Profile), 135°.
       - [ROW 2]: 180° (Back), 225°, 270° (Left Profile), 315°.
    4. OPTICS: 
       - Background: Pure Solid White (#FFFFFF).
       - Lighting: Neutral Studio Global Illumination.
       - Quality: High-resolution textures, no blur, no artistic filters.
    
    HALLUCINATION_BLOCK:
    - NO text, NO labels, NO numbers.
    - NO visible grid lines or borders between frames.
    - NO human hands, mannequins, or external props.
    - THE OUTPUT MUST BE A SINGLE FLAT IMAGE CONTAINING THE 8 SQUARES.
  `;

  try {
    const parts: any[] = [
      { inlineData: { data: frontData, mimeType: 'image/png' } },
      { text: prompt }
    ];

    if (backData) {
      parts.splice(1, 0, { inlineData: { data: backData, mimeType: 'image/png' } });
    }

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "16:9",
          imageSize: "1K"
        }
      },
    });

    let imageUrl = "";
    if (response.candidates && response.candidates[0].content.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!imageUrl) throw new Error("STITCH_VOID: Frame synthesis failed to materialize.");
    return imageUrl;
  } catch (error: any) {
    const errorMsg = error.message || "";
    // If the request fails with this specific message, it indicates an auth/session reset is needed
    if (errorMsg.includes("Requested entity was not found") || errorMsg.includes("403") || errorMsg.includes("key")) {
      throw new Error("AUTH_PROTOCOL_EXPIRED");
    }
    throw error;
  }
};
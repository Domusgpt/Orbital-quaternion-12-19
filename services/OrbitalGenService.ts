import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

export type OrbitalGridResult = {
  pitch0Url: string;
  pitch30Url: string;
};

export const generateOrbitalAssets = async (
  productName: string,
  frontImageBase64: string,
  backImageBase64: string,
  apiKey: string
): Promise<OrbitalGridResult> => {
  if (!apiKey) {
    throw new Error("AUTH_PROTOCOL_EXPIRED");
  }

  const ai = new GoogleGenAI({ apiKey });
  const frontData = frontImageBase64.split(",")[1];
  const backData = backImageBase64.split(",")[1];

  const BASE_PROMPT = `
    TASK: Generate a "Mechanical Sprite Sheet" for "${productName}".
    SYSTEM ARCHITECTURE: Kinetic Sprite Architecture (Orbital Mode).

    MECHANICAL GRID MANIFEST:
    - Structure: 4x2 Grid (8 total cells).
    - Resolution: 1024x512 (Overall), 256x256 (Per Cell).
    - Background: Solid Pure White (#FFFFFF).
    - Alignment: CENTROID ALIGNMENT (Object centered perfectly in each cell).
    - Scale: 75% VOLUMETRIC SCALE (Object fills 75% of cell height/width).

    ORBITAL ROTATION MAP (Y-Axis):
    Row 1: [0° (FRONT)], [45° (FRONT-RIGHT)], [90° (RIGHT PROFILE)], [135° (BACK-RIGHT)]
    Row 2: [180° (BACK)], [225° (BACK-LEFT)], [270° (LEFT PROFILE)], [315° (FRONT-LEFT)]

    STRICT RENDERING RULES:
    1. OBJECT IDENTITY: Product must be 100% identical in every frame.
    2. NO BORDERS: No grid lines or text labels.
    3. CAMERA LOCK: Fixed height, fixed focal length.
  `;

  const generateRing = async (pitchAngle: number): Promise<string> => {
    const angleSpecificPrompt = `
      ${BASE_PROMPT}

      CAMERA PITCH CONFIGURATION:
      - Angle: ${pitchAngle}° (degrees down from horizontal).
      ${pitchAngle === 30 ? '- Context: This is the "Top-Down" view ring.' : '- Context: This is the "Eye-Level" view ring.'}
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-3-pro-image-preview",
      contents: {
        parts: [
          { inlineData: { data: frontData, mimeType: "image/png" } },
          { inlineData: { data: backData, mimeType: "image/png" } },
          { text: angleSpecificPrompt }
        ]
      },
      config: {
        imageConfig: { aspectRatio: "16:9", imageSize: "1K" }
      }
    });

    let imageUrl = "";
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          imageUrl = `data:image/png;base64,${part.inlineData.data}`;
          break;
        }
      }
    }

    if (!imageUrl) {
      throw new Error(`Failed to generate ring at ${pitchAngle}°`);
    }

    return imageUrl;
  };

  const [pitch0Url, pitch30Url] = await Promise.all([
    generateRing(0),
    generateRing(30)
  ]);

  return { pitch0Url, pitch30Url };
};

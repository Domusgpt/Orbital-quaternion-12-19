import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

export type OrbitalGridResult = {
  pitch0Url: string;
  pitch30Url: string;
};

export type OrbitalGenOptions = {
  /**
   * Override the Gemini model for cost/performance tuning.
   * Defaults to gemini-2.5-flash (standard image model) for balanced fidelity.
   */
  model?: "gemini-2.5-flash" | "gemini-2.5-flash-lite" | "gemini-3.0-pro" | string;
  /**
   * Override image size while keeping the 4x2 topology intact (e.g. "768p").
   * Defaults to "1K" to retain the existing mechanical grid fidelity.
   */
  imageSize?: string;
};

export const generateOrbitalAssets = async (
  productName: string,
  frontImageBase64: string,
  backImageBase64: string,
  apiKey: string,
  options: OrbitalGenOptions = {}
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
    - Structure: EXACTLY 4 columns x 2 rows (8 cells total). NEVER produce a 4x4 or any other grid shape.
    - Resolution: 1024x512 (Overall), 256x256 (Per Cell). The canvas aspect ratio must be 2:1. If you attempt a 1:1 (square) canvas, that is incorrect.
    - Background: Solid Pure White (#FFFFFF).
    - Alignment: CENTROID ALIGNMENT (Object centered perfectly in each cell).
    - Scale: 75% VOLUMETRIC SCALE (Object fills 75% of cell height/width).

    ORBITAL ROTATION MAP (Y-Axis):
    Row 1: [0° (FRONT)], [45° (FRONT-RIGHT)], [90° (RIGHT PROFILE)], [135° (BACK-RIGHT)]
    Row 2: [180° (BACK)], [225° (BACK-LEFT)], [270° (LEFT PROFILE)], [315° (FRONT-LEFT)]

    STRICT RENDERING RULES:
    1. OBJECT IDENTITY: Product must be 100% identical in every frame.
    2. NO BORDERS: No grid lines or text labels.
    3. CAMERA LOCK: Fixed height, fixed focal length. Camera never moves; the product travels around a circular rail.
    4. ROTATION DISAMBIGUATION: Keep the camera absolutely still. Imagine the product moving around the camera on a perfect circular rail to each yaw stop (0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°). Do not spin the camera around the product. Each frame must show a unique azimuth and must not repeat a prior view.
    5. GRID VALIDATION: If you generate more than 8 frames (e.g., a 4x4 sheet), discard and regenerate as 4x2. DO NOT add extra rows.
  `;

  const generateRing = async (pitchAngle: number): Promise<string> => {
    const angleSpecificPrompt = `
      ${BASE_PROMPT}

      CAMERA PITCH CONFIGURATION:
      - Angle: ${pitchAngle}° (degrees down from horizontal).
      ${pitchAngle === 30 ? '- Context: This is the "Top-Down" view ring.' : '- Context: This is the "Eye-Level" view ring.'}
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: options.model || "gemini-2.5-flash",
      contents: {
        parts: [
          { inlineData: { data: frontData, mimeType: "image/png" } },
          { inlineData: { data: backData, mimeType: "image/png" } },
          { text: angleSpecificPrompt }
        ]
      },
      config: {
        imageConfig: { aspectRatio: "16:9", imageSize: options.imageSize || "1K" }
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

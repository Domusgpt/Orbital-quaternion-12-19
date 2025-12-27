import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { QUADRANT_GRID, ANGULAR_LABELS } from "../core/QuadrantFrameMap";

export type GenerationMode = 'turnstile' | 'orbital';

export type OrbitalGridResult = {
  pitch0Url: string;
  pitch30Url: string;
  mode: GenerationMode;
};

/**
 * Generate the quadrant-based 4x4 sprite sheet for orbital viewing.
 *
 * Grid Layout (organized by directional hierarchy, NOT angular sequence):
 *
 * Row 0 (Cardinals):      N(0°)      S(180°)    E(90°)     W(270°)
 * Row 1 (Intercardinals): NW(315°)   NE(45°)    SE(135°)   SW(225°)
 * Row 2 (Fine-N/S):       NNW(337.5°) NNE(22.5°) SSE(157.5°) SSW(202.5°)
 * Row 3 (Fine-E/W):       WNW(292.5°) ENE(67.5°) ESE(112.5°) WSW(247.5°)
 *
 * The shader handles the non-sequential angular stitching via lookup table.
 */
export const generateOrbitalAssets = async (
  productName: string,
  frontImageBase64: string,
  backImageBase64: string,
  apiKey: string,
  mode: GenerationMode = 'orbital'
): Promise<OrbitalGridResult> => {
  if (!apiKey) {
    throw new Error("AUTH_PROTOCOL_EXPIRED");
  }

  const ai = new GoogleGenAI({ apiKey });
  const frontData = frontImageBase64.split(",")[1];
  const backData = backImageBase64.split(",")[1];

  // Build the quadrant grid description from our mapping
  const buildQuadrantDescription = (): string => {
    const rows: string[] = [];

    // Row 0: Cardinals
    rows.push(`ROW 1 (Cardinals - Primary views, 90° apart):
  Col 0: NORTH (0°) - Direct front view, facing camera
  Col 1: SOUTH (180°) - Direct back view, back to camera
  Col 2: EAST (90°) - Right profile, 90° clockwise from front
  Col 3: WEST (270°) - Left profile, 90° counter-clockwise from front`);

    // Row 1: Intercardinals
    rows.push(`ROW 2 (Intercardinals - 3/4 views, 45° from cardinals):
  Col 0: NORTHWEST (315°) - 3/4 front-left view
  Col 1: NORTHEAST (45°) - 3/4 front-right view
  Col 2: SOUTHEAST (135°) - 3/4 back-right view
  Col 3: SOUTHWEST (225°) - 3/4 back-left view`);

    // Row 2: Fine N/S
    rows.push(`ROW 3 (Fine North/South - 22.5° precision):
  Col 0: NORTH-NORTHWEST (337.5°) - Slight left from front
  Col 1: NORTH-NORTHEAST (22.5°) - Slight right from front
  Col 2: SOUTH-SOUTHEAST (157.5°) - Slight right from back
  Col 3: SOUTH-SOUTHWEST (202.5°) - Slight left from back`);

    // Row 3: Fine E/W
    rows.push(`ROW 4 (Fine East/West - 22.5° precision):
  Col 0: WEST-NORTHWEST (292.5°) - Between left profile and 3/4 front-left
  Col 1: EAST-NORTHEAST (67.5°) - Between 3/4 front-right and right profile
  Col 2: EAST-SOUTHEAST (112.5°) - Between right profile and 3/4 back-right
  Col 3: WEST-SOUTHWEST (247.5°) - Between 3/4 back-left and left profile`);

    return rows.join('\n\n');
  };

  const BASE_PROMPT = `
TASK: Generate a "Compass Quadrant Sprite Sheet" for "${productName}".
SYSTEM ARCHITECTURE: 16-Point Compass Orbital System.

MECHANICAL GRID MANIFEST:
- Structure: 4x4 Grid (16 total cells).
- Resolution: 1024x1024 (Overall), 256x256 (Per Cell).
- Background: Solid Pure White (#FFFFFF).
- Alignment: CENTROID ALIGNMENT (Object centered perfectly in each cell).
- Scale: 75% VOLUMETRIC SCALE (Object fills 75% of cell height/width).

COMPASS QUADRANT LAYOUT:
${buildQuadrantDescription()}

CRITICAL GENERATION RULES:

1. RIGID ANGULAR CONSISTENCY:
   - Each frame MUST show the object at its EXACT compass angle
   - The HORIZONTAL ROTATION must match the specified degrees precisely
   - N(0°) shows front, E(90°) shows right side, S(180°) shows back, W(270°) shows left side
   - All intermediate angles follow the same rotation axis

2. UNIFORM OBJECT ORIENTATION:
   - The object must maintain the SAME vertical orientation in ALL frames
   - Object should appear to rotate on a vertical axis (like a turntable)
   - NO tilting, leaning, or varying perspectives between cells
   - Each row must have consistent object positioning

3. OBJECT IDENTITY PRESERVATION:
   - Product must be 100% identical in every frame
   - Only the viewing angle changes, never the object itself
   - Maintain consistent scale, lighting, and detail level across all 16 frames

4. TECHNICAL REQUIREMENTS:
   - NO BORDERS: No grid lines, cell dividers, or text labels
   - NO TEXT OR LABELS: Do not render direction names on the image
   - CAMERA LOCK: Fixed height, fixed focal length, fixed distance
   - PURE WHITE BACKGROUND: #FFFFFF exactly, no gradients or shadows
   - SEAMLESS EDGES: No artifacts at cell boundaries

5. ROTATION REFERENCE (viewed from above, clockwise):
   - N (0°): Front view as shown in reference image
   - E (90°): Right side visible (90° clockwise turn)
   - S (180°): Back view, opposite of front
   - W (270°): Left side visible (270° clockwise turn)
  `;

  /**
   * Generate Ring 0 (eye-level, pitch 0°) - the base reference sheet
   */
  const generateRing0 = async (): Promise<string> => {
    const prompt = `
      ${BASE_PROMPT}

      CAMERA PITCH: 0° (Eye-level view)
      - Camera is at the same height as the object center
      - Horizontal viewing angle - not looking up or down
      - This is the PRIMARY reference ring for animation
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: {
        parts: [
          { inlineData: { data: frontData, mimeType: "image/png" } },
          { inlineData: { data: backData, mimeType: "image/png" } },
          { text: prompt }
        ]
      },
      config: {
        responseModalities: ["image", "text"],
        imageSafety: "block_only_high"
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
      throw new Error("Failed to generate Ring 0 (eye-level)");
    }

    return imageUrl;
  };

  /**
   * Generate Ring 1 (elevated, pitch 30°) using Ring 0 as reference
   * This ensures angular consistency between the two rings
   */
  const generateRing1 = async (ring0Base64: string): Promise<string> => {
    const ring0Data = ring0Base64.split(",")[1];

    const prompt = `
      ${BASE_PROMPT}

      CAMERA PITCH: 30° (Elevated view looking down)
      - Camera is positioned above and looking down at 30° angle
      - The object should appear as if viewed from above

      CRITICAL ANGULAR MATCHING REQUIREMENT:
      I am providing a REFERENCE SPRITE SHEET (Ring 0 at 0° pitch).
      You MUST match the EXACT horizontal rotation angles from the reference.

      For each cell in your output:
      - The HORIZONTAL ROTATION must be IDENTICAL to the corresponding cell in the reference
      - Only the VERTICAL VIEWING ANGLE (camera pitch) changes
      - N(0°) in reference = N(0°) in your output, just viewed from 30° above
      - E(90°) in reference = E(90°) in your output, just viewed from 30° above

      The reference sheet shows the correct horizontal rotations.
      Your sheet must show the SAME rotations but from a 30° elevated camera angle.

      DO NOT change the object's rotation - only change the camera's vertical position.
    `;

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: {
        parts: [
          { inlineData: { data: frontData, mimeType: "image/png" } },
          { inlineData: { data: backData, mimeType: "image/png" } },
          { inlineData: { data: ring0Data, mimeType: "image/png" } },
          { text: prompt }
        ]
      },
      config: {
        responseModalities: ["image", "text"],
        imageSafety: "block_only_high"
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
      throw new Error("Failed to generate Ring 1 (elevated)");
    }

    return imageUrl;
  };

  // Generate Ring 0 first (always needed)
  console.log("Generating Ring 0 (eye-level)...");
  const pitch0Url = await generateRing0();

  let pitch30Url: string;
  if (mode === 'orbital') {
    // Orbital mode: generate Ring 1 using Ring 0 as reference for consistency
    console.log("Generating Ring 1 (elevated, using Ring 0 as reference)...");
    pitch30Url = await generateRing1(pitch0Url);
  } else {
    // Turnstile mode: reuse Ring 0 (single axis, no pitch variation)
    pitch30Url = pitch0Url;
  }

  return { pitch0Url, pitch30Url, mode };
};

/**
 * Get descriptive prompt for a specific compass direction
 * Useful for single-frame generation or debugging
 */
export const getDirectionPrompt = (direction: string): string => {
  const frame = QUADRANT_GRID.find(f => f.direction === direction);
  if (!frame) {
    throw new Error(`Unknown direction: ${direction}`);
  }

  const descriptions: Record<string, string> = {
    'N': 'Direct front view, facing camera',
    'S': 'Direct back view, back to camera',
    'E': 'Right profile, 90° clockwise from front',
    'W': 'Left profile, 90° counter-clockwise from front',
    'NE': '3/4 front-right view',
    'NW': '3/4 front-left view',
    'SE': '3/4 back-right view',
    'SW': '3/4 back-left view',
    'NNE': 'Slight right from front',
    'NNW': 'Slight left from front',
    'SSE': 'Slight right from back',
    'SSW': 'Slight left from back',
    'ENE': 'Between 3/4 front-right and right profile',
    'ESE': 'Between right profile and 3/4 back-right',
    'WNW': 'Between left profile and 3/4 front-left',
    'WSW': 'Between 3/4 back-left and left profile',
  };

  return `${frame.direction} (${frame.angle}°): ${descriptions[frame.direction] || 'View at specified angle'}`;
};

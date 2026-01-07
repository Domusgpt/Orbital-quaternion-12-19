import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { QUADRANT_GRID, ANGULAR_LABELS } from "../core/QuadrantFrameMap";

export type OrbitalGridResult = {
  sheet0Url: string;
  sheet1Url: string;
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
  apiKey: string
): Promise<OrbitalGridResult> => {
  if (!apiKey) {
    throw new Error("AUTH_PROTOCOL_EXPIRED");
  }

  const ai = new GoogleGenAI({ apiKey });
  const frontData = frontImageBase64.split(",")[1];
  const backData = backImageBase64.split(",")[1];

  // Build the quadrant grid description - base angles (0°, 22.5°, 45°, ...)
  const buildQuadrantDescriptionBase = (): string => {
    const rows: string[] = [];

    rows.push(`ROW 1 (Cardinals - Primary views, 90° apart):
  Col 0: NORTH (0°) - Direct front view, facing camera
  Col 1: SOUTH (180°) - Direct back view, back to camera
  Col 2: EAST (90°) - Right profile, 90° clockwise from front
  Col 3: WEST (270°) - Left profile, 90° counter-clockwise from front`);

    rows.push(`ROW 2 (Intercardinals - 3/4 views, 45° from cardinals):
  Col 0: NORTHWEST (315°) - 3/4 front-left view
  Col 1: NORTHEAST (45°) - 3/4 front-right view
  Col 2: SOUTHEAST (135°) - 3/4 back-right view
  Col 3: SOUTHWEST (225°) - 3/4 back-left view`);

    rows.push(`ROW 3 (Fine North/South - 22.5° precision):
  Col 0: NORTH-NORTHWEST (337.5°) - Slight left from front
  Col 1: NORTH-NORTHEAST (22.5°) - Slight right from front
  Col 2: SOUTH-SOUTHEAST (157.5°) - Slight right from back
  Col 3: SOUTH-SOUTHWEST (202.5°) - Slight left from back`);

    rows.push(`ROW 4 (Fine East/West - 22.5° precision):
  Col 0: WEST-NORTHWEST (292.5°) - Between left profile and 3/4 front-left
  Col 1: EAST-NORTHEAST (67.5°) - Between 3/4 front-right and right profile
  Col 2: EAST-SOUTHEAST (112.5°) - Between right profile and 3/4 back-right
  Col 3: WEST-SOUTHWEST (247.5°) - Between 3/4 back-left and left profile`);

    return rows.join('\n\n');
  };

  const buildBasePrompt = () => `
TASK: Generate a "Compass Quadrant Sprite Sheet" for "${productName}".
SYSTEM ARCHITECTURE: 16-Point Compass Orbital System.

MECHANICAL GRID MANIFEST:
- Structure: 4x4 Grid (16 total cells).
- Resolution: 1024x1024 (Overall), 256x256 (Per Cell).
- Background: Solid Pure White (#FFFFFF).
- Alignment: CENTROID ALIGNMENT (Object centered perfectly in each cell).
- Scale: 75% VOLUMETRIC SCALE (Object fills 75% of cell height/width).

COMPASS QUADRANT LAYOUT:
${buildQuadrantDescriptionBase()}

CRITICAL GENERATION RULES:

1. HIERARCHICAL IMPORTANCE:
   - Row 1 (Cardinals) are the anchor frames - most important for recognition
   - Row 2 (Intercardinals) bridge the 90° gaps smoothly
   - Rows 3-4 (Fine directions) add smooth interpolation detail

2. ANGULAR CONSISTENCY:
   - Each frame MUST represent its exact compass direction
   - Adjacent directions (22.5° apart) must blend smoothly
   - N(0°) and NNW(337.5°) must visually connect (wrap-around)

3. OBJECT IDENTITY:
   - Product must be 100% identical in every frame
   - Only the viewing angle changes, never the object itself
   - Maintain consistent scale, lighting, and detail level

4. TECHNICAL REQUIREMENTS:
   - NO BORDERS: No grid lines or text labels
   - CAMERA LOCK: Fixed height, fixed focal length, EYE-LEVEL (pitch 0°)
   - PURE WHITE BACKGROUND: #FFFFFF exactly
   - SEAMLESS EDGES: No artifacts at cell boundaries

5. ROTATION REFERENCE:
   - N (0°): Front view as shown in reference image
   - Angles increase CLOCKWISE when viewed from above
   - E (90°): 90° clockwise = right side visible
   - S (180°): Back view, opposite of front
   - W (270°): 270° clockwise = left side visible
  `;

  const generateSheet = async (): Promise<string> => {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [
        { inlineData: { data: frontData, mimeType: "image/png" } },
        { inlineData: { data: backData, mimeType: "image/png" } },
        { text: buildBasePrompt() }
      ]
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
      throw new Error("Failed to generate sprite sheet");
    }

    return imageUrl;
  };

  // Generate single sheet
  const sheetUrl = await generateSheet();

  return { sheet0Url: sheetUrl, sheet1Url: sheetUrl };
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

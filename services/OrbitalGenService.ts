import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { QUADRANT_GRID, ANGULAR_LABELS } from "../core/QuadrantFrameMap";

export type OrbitalGridResult = {
  sheet0Url: string;  // Base angles: 0°, 22.5°, 45°, ...
  sheet1Url: string;  // Offset angles: 11.25°, 33.75°, 56.25°, ... (for 32-frame fluidity)
};

/**
 * Generate the 4x4 sprite sheet for orbital viewing.
 *
 * Grid Layout (logical hierarchy - main views first, then offsets):
 *
 * Row 0 (Cardinals):           N(0°)     E(90°)    S(180°)   W(270°)
 * Row 1 (Intercardinals):      NE(45°)   SE(135°)  SW(225°)  NW(315°)
 * Row 2 (Cardinal+22.5°):      22.5°     112.5°    202.5°    292.5°
 * Row 3 (Intercardinal+22.5°): 67.5°     157.5°    247.5°    337.5°
 *
 * All 16 angles at 22.5° intervals on a single sheet.
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

  // Build the grid description - all 16 angles on one sheet
  const buildGridDescription = (): string => {
    const rows: string[] = [];

    rows.push(`ROW 1 (Cardinals - The 4 main views, 90° apart):
  Col 0: FRONT (0°) - Direct front view, facing camera
  Col 1: RIGHT (90°) - Right side profile, 90° clockwise from front
  Col 2: BACK (180°) - Direct back view, opposite of front
  Col 3: LEFT (270°) - Left side profile, 90° counter-clockwise from front`);

    rows.push(`ROW 2 (Intercardinals - The 4 corner/diagonal views, 45° from cardinals):
  Col 0: FRONT-RIGHT (45°) - 3/4 view showing front and right side
  Col 1: BACK-RIGHT (135°) - 3/4 view showing back and right side
  Col 2: BACK-LEFT (225°) - 3/4 view showing back and left side
  Col 3: FRONT-LEFT (315°) - 3/4 view showing front and left side`);

    rows.push(`ROW 3 (Cardinal Offsets - Each Row 1 view rotated 22.5° clockwise):
  Col 0: 22.5° - Slightly rotated from FRONT toward FRONT-RIGHT
  Col 1: 112.5° - Slightly rotated from RIGHT toward BACK-RIGHT
  Col 2: 202.5° - Slightly rotated from BACK toward BACK-LEFT
  Col 3: 292.5° - Slightly rotated from LEFT toward FRONT-LEFT`);

    rows.push(`ROW 4 (Intercardinal Offsets - Each Row 2 view rotated 22.5° clockwise):
  Col 0: 67.5° - Between FRONT-RIGHT and RIGHT
  Col 1: 157.5° - Between BACK-RIGHT and BACK
  Col 2: 247.5° - Between BACK-LEFT and LEFT
  Col 3: 337.5° - Between FRONT-LEFT and FRONT`);

    return rows.join('\n\n');
  };

  const buildPrompt = () => `
TASK: Generate a 4x4 rotation sprite sheet for "${productName}".

GRID STRUCTURE:
- 4x4 Grid (16 total cells)
- Resolution: 1024x1024 overall, 256x256 per cell
- Background: Pure White (#FFFFFF)
- Object: Centered in each cell, 75% of cell size

CELL LAYOUT:
${buildGridDescription()}

GENERATION RULES:

1. ROW PRIORITY:
   - Row 1: The 4 main views (front, right, back, left) - get these perfect first
   - Row 2: The 4 diagonal views (corners) - between the main views
   - Rows 3-4: Slight rotations of Rows 1-2 (22.5° offset)

2. ROTATION LOGIC:
   - Imagine the object on a turntable rotating clockwise
   - 0° = front (as shown in first reference image)
   - 90° = right side visible
   - 180° = back (as shown in second reference image)
   - 270° = left side visible

3. CONSISTENCY:
   - SAME object in every cell - only viewing angle changes
   - SAME scale, lighting, and centering throughout
   - Smooth visual progression between adjacent angles

4. TECHNICAL:
   - NO borders, grid lines, or labels
   - NO text or watermarks
   - Pure white background only
  `;

  const generateSheet = async (): Promise<string> => {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [
        { inlineData: { data: frontData, mimeType: "image/png" } },
        { inlineData: { data: backData, mimeType: "image/png" } },
        { text: buildPrompt() }
      ],
      config: {
        imageConfig: { aspectRatio: "1:1" }
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
      throw new Error("Failed to generate sprite sheet");
    }

    return imageUrl;
  };

  // Generate single sheet with all 16 angles
  const sheetUrl = await generateSheet();

  // Return same sheet for both (backward compatible)
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

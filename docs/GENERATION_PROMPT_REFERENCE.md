# Generation Prompt Reference

This document captures the WORKING prompt template and settings. DO NOT modify the actual generation service without referencing this document and making small, incremental changes.

---

## System Architecture: 32-Frame Interleaved

The system generates **2 sheets** with **32 total frames** (16 per sheet):
- **Sheet 0 (Base)**: Standard compass angles (0°, 22.5°, 45°, ...)
- **Sheet 1 (Offset)**: Interleaved angles (+11.25° offset: 11.25°, 33.75°, 56.25°, ...)

This provides 11.25° angular resolution for smooth rotation.

---

## Current Working Configuration

### Model
```
gemini-2.0-flash-exp
```

### API Config
```javascript
config: {
  imageConfig: { aspectRatio: "1:1", imageSize: "1K" }
}
```

### Input Structure
```javascript
contents: {
  parts: [
    { inlineData: { data: frontData, mimeType: "image/png" } },  // Front reference image
    { inlineData: { data: backData, mimeType: "image/png" } },   // Back reference image
    { text: prompt }                                              // Base or Offset prompt
  ]
}
```

---

## Working Prompt Templates

### Sheet 0: Base Prompt (Standard Compass Angles)

```
TASK: Generate a "Compass Quadrant Sprite Sheet" for "${productName}".
SYSTEM ARCHITECTURE: 16-Point Compass Orbital System.

MECHANICAL GRID MANIFEST:
- Structure: 4x4 Grid (16 total cells).
- Resolution: 1024x1024 (Overall), 256x256 (Per Cell).
- Background: Solid Pure White (#FFFFFF).
- Alignment: CENTROID ALIGNMENT (Object centered perfectly in each cell).
- Scale: 75% VOLUMETRIC SCALE (Object fills 75% of cell height/width).

COMPASS QUADRANT LAYOUT:
ROW 1 (Cardinals - Primary views, 90° apart):
  Col 0: NORTH (0°) - Direct front view, facing camera
  Col 1: SOUTH (180°) - Direct back view, back to camera
  Col 2: EAST (90°) - Right profile, 90° clockwise from front
  Col 3: WEST (270°) - Left profile, 90° counter-clockwise from front

ROW 2 (Intercardinals - 3/4 views, 45° from cardinals):
  Col 0: NORTHWEST (315°) - 3/4 front-left view
  Col 1: NORTHEAST (45°) - 3/4 front-right view
  Col 2: SOUTHEAST (135°) - 3/4 back-right view
  Col 3: SOUTHWEST (225°) - 3/4 back-left view

ROW 3 (Fine North/South - 22.5° precision):
  Col 0: NORTH-NORTHWEST (337.5°) - Slight left from front
  Col 1: NORTH-NORTHEAST (22.5°) - Slight right from front
  Col 2: SOUTH-SOUTHEAST (157.5°) - Slight right from back
  Col 3: SOUTH-SOUTHWEST (202.5°) - Slight left from back

ROW 4 (Fine East/West - 22.5° precision):
  Col 0: WEST-NORTHWEST (292.5°) - Between left profile and 3/4 front-left
  Col 1: EAST-NORTHEAST (67.5°) - Between 3/4 front-right and right profile
  Col 2: EAST-SOUTHEAST (112.5°) - Between right profile and 3/4 back-right
  Col 3: WEST-SOUTHWEST (247.5°) - Between 3/4 back-left and left profile

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
   - CAMERA LOCK: Fixed height, fixed focal length
   - PURE WHITE BACKGROUND: #FFFFFF exactly
   - SEAMLESS EDGES: No artifacts at cell boundaries

5. ROTATION REFERENCE:
   - N (0°): Front view as shown in reference image
   - Angles increase CLOCKWISE when viewed from above
   - E (90°): 90° clockwise = right side visible
   - S (180°): Back view, opposite of front
   - W (270°): 270° clockwise = left side visible
```

### Sheet 1: Offset Prompt (+11.25° Interleaved Angles)

```
TASK: Generate an "Offset Angle Sprite Sheet" for "${productName}".
SYSTEM ARCHITECTURE: 16-Point OFFSET Angles (+11.25° from standard compass).

MECHANICAL GRID MANIFEST:
- Structure: 4x4 Grid (16 total cells).
- Resolution: 1024x1024 (Overall), 256x256 (Per Cell).
- Background: Solid Pure White (#FFFFFF).
- Alignment: CENTROID ALIGNMENT (Object centered perfectly in each cell).
- Scale: 75% VOLUMETRIC SCALE (Object fills 75% of cell height/width).

OFFSET ANGLE LAYOUT (each angle is 11.25° AFTER the standard compass direction):
ROW 1 (Offset Cardinals - 11.25° offset from base):
  Col 0: 11.25° - Between front and NNE
  Col 1: 191.25° - Between back and SSW
  Col 2: 101.25° - Between right profile and ESE
  Col 3: 281.25° - Between left profile and WNW

ROW 2 (Offset Intercardinals - 11.25° offset):
  Col 0: 326.25° - Between NW and NNW
  Col 1: 56.25° - Between NE and ENE
  Col 2: 146.25° - Between SE and SSE
  Col 3: 236.25° - Between SW and WSW

ROW 3 (Offset Fine N/S - 11.25° offset):
  Col 0: 348.75° - Between NNW and N
  Col 1: 33.75° - Between NNE and NE
  Col 2: 168.75° - Between SSE and S
  Col 3: 213.75° - Between SSW and SW

ROW 4 (Offset Fine E/W - 11.25° offset):
  Col 0: 303.75° - Between WNW and NW
  Col 1: 78.75° - Between ENE and E
  Col 2: 123.75° - Between ESE and SE
  Col 3: 258.75° - Between WSW and W

CRITICAL GENERATION RULES:

1. OFFSET PURPOSE:
   - These frames fill the gaps between standard compass directions
   - Combined with base sheet, creates 32 total angles (11.25° apart)
   - Each frame is exactly halfway between two standard compass points

2. ANGULAR PRECISION:
   - Each frame MUST represent its EXACT offset angle
   - 11.25° is a small rotation - frames should look very similar to adjacent base frames
   - Smooth progression between all 32 combined angles

3. OBJECT IDENTITY:
   - Product must be 100% identical to base sheet
   - Same scale, same lighting, same detail level
   - ONLY viewing angle differs

4. TECHNICAL REQUIREMENTS:
   - NO BORDERS: No grid lines or text labels
   - CAMERA LOCK: Fixed height, fixed focal length, EYE-LEVEL (pitch 0°)
   - PURE WHITE BACKGROUND: #FFFFFF exactly
   - MATCH BASE SHEET: Same object appearance, just rotated 11.25° from base positions

5. ROTATION REFERENCE:
   - All angles are 11.25° clockwise from standard compass
   - 11.25° = halfway between N(0°) and NNE(22.5°)
   - Angles increase CLOCKWISE when viewed from above
```

---

## Grid Layout Reference

```
Frame Index → Grid Position → Direction → Angle

Row 0 (Cardinals):
  0  → (0,0) → N   → 0°
  1  → (0,1) → S   → 180°
  2  → (0,2) → E   → 90°
  3  → (0,3) → W   → 270°

Row 1 (Intercardinals):
  4  → (1,0) → NW  → 315°
  5  → (1,1) → NE  → 45°
  6  → (1,2) → SE  → 135°
  7  → (1,3) → SW  → 225°

Row 2 (Fine N/S):
  8  → (2,0) → NNW → 337.5°
  9  → (2,1) → NNE → 22.5°
  10 → (2,2) → SSE → 157.5°
  11 → (2,3) → SSW → 202.5°

Row 3 (Fine E/W):
  12 → (3,0) → WNW → 292.5°
  13 → (3,1) → ENE → 67.5°
  14 → (3,2) → ESE → 112.5°
  15 → (3,3) → WSW → 247.5°
```

## 32-Frame Angular Sequence (for stitching)

With 2 sheets interleaved, we have 32 frames at 11.25° apart:

```
Global Index → Sheet → Local Frame → Degrees
0  → Sheet0 → F0  (N)    → 0°
1  → Sheet1 → F0         → 11.25°
2  → Sheet0 → F9  (NNE)  → 22.5°
3  → Sheet1 → F9         → 33.75°
4  → Sheet0 → F5  (NE)   → 45°
5  → Sheet1 → F5         → 56.25°
... and so on for all 32 frames
```

The shader handles this interleaving:
- Even indices (0, 2, 4, ...) → Sheet 0 (base angles)
- Odd indices (1, 3, 5, ...) → Sheet 1 (offset angles)

---

## Shader Frame Selection Logic

```glsl
// Turnstile mode: 32 frames (11.25° per frame)
float angleFloat32 = yawDeg / 11.25;
int globalIndex = int(floor(angleFloat32));

// Determine which sheet
bool fromSheet1 = mod(float(globalIndex), 2.0) > 0.5;

// Convert to local 16-frame index
int localIndex = globalIndex / 2;
float frameIndex = getFrameIndex(localIndex);

// Sample from appropriate sheet
vec4 color = fromSheet1
  ? sampleFrame(u_textureRing1, frameIndex, uv)
  : sampleFrame(u_textureRing0, frameIndex, uv);
```

---

## Known Issues to Address

1. **Offset sheet consistency** - The offset sheet must match base sheet's object identity exactly
2. **11.25° precision** - AI may struggle with such small angular differences
3. **Style drift** - Sheet 1 may not match Sheet 0's visual style

## Future Scaling (Multi-Pitch Orbital)

Once turnstile (32 frames, 1 pitch) is working:
- Add more sheets at different pitch angles (15°, 30°, 45°, etc.)
- Each pitch level gets its own pair of base+offset sheets
- Shader blends between pitch levels based on camera angle

---

## Change Log

| Date | Change | Result |
|------|--------|--------|
| Initial | Base prompt created | Working 4x4 grids |
| 12-27 | 32-frame interleaved system | Base + Offset sheets |


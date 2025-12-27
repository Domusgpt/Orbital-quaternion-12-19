# Generation Prompt Reference

This document captures the WORKING prompt template and settings. DO NOT modify the actual generation service without referencing this document and making small, incremental changes.

---

## Current Working Configuration

### Model
```
gemini-3-pro-image-preview
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
    { text: angleSpecificPrompt }                                 // The prompt
  ]
}
```

---

## Working Prompt Template

### Base Prompt (QUADRANT_PROMPT)

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

### Ring-Specific Additions

#### Ring 0 (Pitch 0° - Eye Level)
```
CAMERA PITCH CONFIGURATION:
- Pitch Angle: 0° (degrees down from horizontal)
- Context: EYE-LEVEL view ring - camera at object horizon
```

#### Ring 1 (Pitch 30° - Elevated)
```
CAMERA PITCH CONFIGURATION:
- Pitch Angle: 30° (degrees down from horizontal)
- Context: ELEVATED view ring - camera looking down at object
- Note: All 16 compass directions maintain their horizontal rotation, only vertical camera angle changes
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

## Angular Sequence (for stitching)

The frames are NOT in angular order in the grid. This is the angular sequence for smooth rotation:

```
Angle Index → Frame Index → Direction → Degrees
0  → 0  → N   → 0°
1  → 9  → NNE → 22.5°
2  → 5  → NE  → 45°
3  → 13 → ENE → 67.5°
4  → 2  → E   → 90°
5  → 14 → ESE → 112.5°
6  → 6  → SE  → 135°
7  → 10 → SSE → 157.5°
8  → 1  → S   → 180°
9  → 11 → SSW → 202.5°
10 → 7  → SW  → 225°
11 → 15 → WSW → 247.5°
12 → 3  → W   → 270°
13 → 12 → WNW → 292.5°
14 → 4  → NW  → 315°
15 → 8  → NNW → 337.5°
```

---

## Known Issues to Address

1. **Ring 1 consistency** - The elevated ring sometimes has different object orientations than Ring 0
2. **Row 2 angle mismatch** - Sometimes row 2 objects appear at different angles than expected
3. **Style drift** - Ring 1 may not match Ring 0's visual style

## Proposed Improvements (TO TEST INCREMENTALLY)

1. Use Ring 0 output as additional input when generating Ring 1
2. Add explicit prompt language about matching Ring 0's rotations
3. Try different model versions
4. Generate 4 sheets instead of 2 for finer pitch gradations

---

## Change Log

| Date | Change | Result |
|------|--------|--------|
| Initial | Base prompt created | Working 4x4 grids |
| | | |


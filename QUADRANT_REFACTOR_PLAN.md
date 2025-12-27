# Quadrant Frame Refactor Plan

## Overview

Refactor the incremental frame generation to use a **compass-quadrant** system where:
- Frames are organized by directional hierarchy (cardinals → intercardinals → fine directions)
- Stitching uses angular sequence lookup rather than grid-sequential blending

---

## Current vs Proposed Grid Layout

### CURRENT (8-frame, 4×2 grid, sequential)
```
Row 0: [0°] [45°] [90°] [135°]
Row 1: [180°] [225°] [270°] [315°]
```
Frames are in sequential angular order.

### PROPOSED (16-frame, 4×4 grid, quadrant-grouped)
```
Row 0: N(0°)      S(180°)    E(90°)     W(270°)     ← Cardinals
Row 1: NW(315°)   NE(45°)    SE(135°)   SW(225°)    ← Intercardinals
Row 2: NNW(337.5°) NNE(22.5°) SSE(157.5°) SSW(202.5°) ← Fine-N/S
Row 3: WNW(292.5°) ENE(67.5°) ESE(112.5°) WSW(247.5°) ← Fine-E/W
```

---

## Angular Sequence Mapping

The **true angular order** for smooth rotation (0° → 360°):

| Angle | Direction | Grid Position | Frame Index |
|-------|-----------|---------------|-------------|
| 0.0° | N | [0,0] | 0 |
| 22.5° | NNE | [2,1] | 9 |
| 45.0° | NE | [1,1] | 5 |
| 67.5° | ENE | [3,1] | 13 |
| 90.0° | E | [0,2] | 2 |
| 112.5° | ESE | [3,2] | 14 |
| 135.0° | SE | [1,2] | 6 |
| 157.5° | SSE | [2,2] | 10 |
| 180.0° | S | [0,1] | 1 |
| 202.5° | SSW | [2,3] | 11 |
| 225.0° | SW | [1,3] | 7 |
| 247.5° | WSW | [3,3] | 15 |
| 270.0° | W | [0,3] | 3 |
| 292.5° | WNW | [3,0] | 12 |
| 315.0° | NW | [1,0] | 4 |
| 337.5° | NNW | [2,0] | 8 |

**Stitching Sequence (by frame index):**
`[0, 9, 5, 13, 2, 14, 6, 10, 1, 11, 7, 15, 3, 12, 4, 8]` → wraps back to 0

---

## Implementation Tasks

### 1. Create Quadrant Constants Module
**File:** `core/QuadrantFrameMap.ts` (NEW)

```typescript
// Compass directions with metadata
export interface CompassFrame {
  direction: string;      // "N", "NNE", "NE", etc.
  angle: number;          // degrees 0-360
  gridRow: number;        // 0-3
  gridCol: number;        // 0-3
  frameIndex: number;     // gridRow * 4 + gridCol
}

// All 16 frames in GRID order (for generation)
export const QUADRANT_GRID: CompassFrame[] = [
  // Row 0: Cardinals
  { direction: 'N',   angle: 0,     gridRow: 0, gridCol: 0, frameIndex: 0 },
  { direction: 'S',   angle: 180,   gridRow: 0, gridCol: 1, frameIndex: 1 },
  { direction: 'E',   angle: 90,    gridRow: 0, gridCol: 2, frameIndex: 2 },
  { direction: 'W',   angle: 270,   gridRow: 0, gridCol: 3, frameIndex: 3 },
  // Row 1: Intercardinals
  { direction: 'NW',  angle: 315,   gridRow: 1, gridCol: 0, frameIndex: 4 },
  { direction: 'NE',  angle: 45,    gridRow: 1, gridCol: 1, frameIndex: 5 },
  { direction: 'SE',  angle: 135,   gridRow: 1, gridCol: 2, frameIndex: 6 },
  { direction: 'SW',  angle: 225,   gridRow: 1, gridCol: 3, frameIndex: 7 },
  // Row 2: Fine-N/S
  { direction: 'NNW', angle: 337.5, gridRow: 2, gridCol: 0, frameIndex: 8 },
  { direction: 'NNE', angle: 22.5,  gridRow: 2, gridCol: 1, frameIndex: 9 },
  { direction: 'SSE', angle: 157.5, gridRow: 2, gridCol: 2, frameIndex: 10 },
  { direction: 'SSW', angle: 202.5, gridRow: 2, gridCol: 3, frameIndex: 11 },
  // Row 3: Fine-E/W
  { direction: 'WNW', angle: 292.5, gridRow: 3, gridCol: 0, frameIndex: 12 },
  { direction: 'ENE', angle: 67.5,  gridRow: 3, gridCol: 1, frameIndex: 13 },
  { direction: 'ESE', angle: 112.5, gridRow: 3, gridCol: 2, frameIndex: 14 },
  { direction: 'WSW', angle: 247.5, gridRow: 3, gridCol: 3, frameIndex: 15 },
];

// Sorted by angle for STITCHING order
export const ANGULAR_SEQUENCE: number[] = [
  0,   // N     (0°)
  9,   // NNE   (22.5°)
  5,   // NE    (45°)
  13,  // ENE   (67.5°)
  2,   // E     (90°)
  14,  // ESE   (112.5°)
  6,   // SE    (135°)
  10,  // SSE   (157.5°)
  1,   // S     (180°)
  11,  // SSW   (202.5°)
  7,   // SW    (225°)
  15,  // WSW   (247.5°)
  3,   // W     (270°)
  12,  // WNW   (292.5°)
  4,   // NW    (315°)
  8,   // NNW   (337.5°)
];

// Reverse lookup: angle index (0-15) → frame index
export const ANGLE_TO_FRAME: number[] = ANGULAR_SEQUENCE;

// Reverse lookup: frame index → angle index (position in angular sequence)
export const FRAME_TO_ANGLE_INDEX: number[] =
  ANGULAR_SEQUENCE.reduce((acc, frameIdx, angleIdx) => {
    acc[frameIdx] = angleIdx;
    return acc;
  }, new Array(16));

// Get frame indices for blending given yaw angle
export function getBlendFrames(yawDegrees: number): {
  frameA: number;
  frameB: number;
  blend: number;
} {
  // Normalize to 0-360
  const yaw = ((yawDegrees % 360) + 360) % 360;

  // Each of 16 frames covers 22.5° (360/16)
  const angleIndex = (yaw / 22.5);
  const angleIndexA = Math.floor(angleIndex) % 16;
  const angleIndexB = (angleIndexA + 1) % 16;
  const blend = angleIndex - Math.floor(angleIndex);

  return {
    frameA: ANGULAR_SEQUENCE[angleIndexA],
    frameB: ANGULAR_SEQUENCE[angleIndexB],
    blend
  };
}
```

---

### 2. Update Shader Frame Sampling
**File:** `core/shaders/OrbitalShaderModules.ts`

Changes:
- Update grid from 4×2 to 4×4
- Add uniform for angular sequence lookup
- Create new sampling function that handles non-sequential frames

```glsl
// NEW: 4x4 grid sampling (16 frames)
vec4 sampleQuadrantFrame(sampler2D tex, float frameIndex, vec2 uv) {
  float col = mod(frameIndex, 4.0);    // 0-3
  float row = floor(frameIndex / 4.0); // 0-3

  vec2 finalUV = vec2(
    (col + uv.x) / 4.0,
    1.0 - ((row + (1.0 - uv.y)) / 4.0)  // Changed: /4.0 for 4 rows
  );
  return texture2D(tex, finalUV);
}

// NEW: Angular sequence lookup (passed as uniform array)
uniform float u_angularSequence[16];

// NEW: Get frame pair for blending
void getBlendFrames(float yawDegrees, out float frameA, out float frameB, out float blend) {
  float yaw = mod(yawDegrees, 360.0);
  float angleIndex = yaw / 22.5;

  int idxA = int(floor(angleIndex)) % 16;
  int idxB = (idxA + 1) % 16;

  frameA = u_angularSequence[idxA];
  frameB = u_angularSequence[idxB];
  blend = fract(angleIndex);
}
```

---

### 3. Update Generation Service
**File:** `services/OrbitalGenService.ts`

Update the prompt to generate frames in quadrant order:

```typescript
const QUADRANT_PROMPT = `
Create a 4×4 sprite sheet grid with 16 character views:

ROW 1 (Cardinals - 90° apart):
  Col 0: NORTH (0°) - facing camera
  Col 1: SOUTH (180°) - back to camera
  Col 2: EAST (90°) - right profile
  Col 3: WEST (270°) - left profile

ROW 2 (Intercardinals - 45° from cardinals):
  Col 0: NORTHWEST (315°) - 3/4 front-left
  Col 1: NORTHEAST (45°) - 3/4 front-right
  Col 2: SOUTHEAST (135°) - 3/4 back-right
  Col 3: SOUTHWEST (225°) - 3/4 back-left

ROW 3 (Fine-N/S - 22.5° precision):
  Col 0: NORTH-NORTHWEST (337.5°)
  Col 1: NORTH-NORTHEAST (22.5°)
  Col 2: SOUTH-SOUTHEAST (157.5°)
  Col 3: SOUTH-SOUTHWEST (202.5°)

ROW 4 (Fine-E/W - 22.5° precision):
  Col 0: WEST-NORTHWEST (292.5°)
  Col 1: EAST-NORTHEAST (67.5°)
  Col 2: EAST-SOUTHEAST (112.5°)
  Col 3: WEST-SOUTHWEST (247.5°)

Requirements:
- Maintain centroid alignment across all 16 frames
- 75% volumetric scale in each cell
- Consistent lighting and style
`;
```

---

### 4. Update Visualizer for 16-frame Interpolation
**File:** `core/ProductOrbitVisualizer.ts`

- Pass angular sequence as uniform
- Update blend calculation to use lookup

```typescript
// Add uniform for angular sequence
this.gl.uniform1fv(
  this.gl.getUniformLocation(this.program, 'u_angularSequence'),
  new Float32Array(ANGULAR_SEQUENCE)
);
```

---

### 5. Update UI Components
**File:** `components/DKGPlayer.tsx`

Update to show 16 compass directions in scrubber:

```typescript
const COMPASS_LABELS = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
];
```

---

## Visual Representation

### Angular Stitching Diagram

```
                    N (0°)
                    ↓
         NNW ← → NNE
        (337.5)   (22.5)
           ↖   ↗
    NW ←      →  NE
   (315)       (45)
      ↖       ↗
 WNW ←   ←→   → ENE
(292.5)      (67.5)
    ↑          ↑
    W ←──────→ E
  (270)      (90)
    ↓          ↓
 WSW ←   ←→   → ESE
(247.5)      (112.5)
      ↙       ↘
    SW ←      →  SE
   (225)       (135)
           ↙   ↘
        SSW ← → SSE
       (202.5)  (157.5)
                    ↓
                  S (180°)
```

### Grid vs Angular Order Visualization

```
GRID ORDER (how frames are stored):        ANGULAR ORDER (how frames blend):
┌───┬───┬───┬───┐                          0° → 22.5° → 45° → 67.5° → 90° ...
│ 0 │ 1 │ 2 │ 3 │  Row 0
│ N │ S │ E │ W │                          Frame: 0 → 9 → 5 → 13 → 2 → 14 → ...
├───┼───┼───┼───┤
│ 4 │ 5 │ 6 │ 7 │  Row 1                   The shader samples:
│NW │NE │SE │SW │                          - frameA from ANGULAR_SEQUENCE[i]
├───┼───┼───┼───┤                          - frameB from ANGULAR_SEQUENCE[i+1]
│ 8 │ 9 │10 │11 │  Row 2                   - blends based on fractional position
│NNW│NNE│SSE│SSW│
├───┼───┼───┼───┤
│12 │13 │14 │15 │  Row 3
│WNW│ENE│ESE│WSW│
└───┴───┴───┴───┘
```

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `core/QuadrantFrameMap.ts` | NEW | Constants, mappings, helper functions |
| `core/shaders/OrbitalShaderModules.ts` | MODIFY | 4×4 grid sampling, angular sequence uniform |
| `services/OrbitalGenService.ts` | MODIFY | Updated generation prompt for 16 frames |
| `core/ProductOrbitVisualizer.ts` | MODIFY | Pass angular sequence uniform, 16-frame logic |
| `components/DKGPlayer.tsx` | MODIFY | 16 compass direction labels |
| `ui/orbital/OrbitalInputBridge.ts` | MODIFY | Sensitivity adjustments for 22.5° resolution |

---

## Implementation Order

1. **Create `QuadrantFrameMap.ts`** - Foundation with all constants and helpers
2. **Update shaders** - New 4×4 sampling + angular sequence lookup
3. **Update visualizer** - Pass uniforms, update render logic
4. **Update generation service** - New prompt for 16-frame quadrant grid
5. **Update UI components** - 16 compass direction display
6. **Test & validate** - Ensure smooth interpolation around the compass

---

## Benefits of This Approach

1. **Hierarchical Generation**: Cardinals (most important) generated first, then refined
2. **Graceful Degradation**: Can use just Row 0-1 for 8-frame fallback
3. **Logical Grouping**: Each row has semantic meaning (cardinal/intercardinal/fine)
4. **Non-sequential Flexibility**: Shader handles any frame arrangement via lookup
5. **22.5° Precision**: Smoother rotation with 16 distinct viewpoints

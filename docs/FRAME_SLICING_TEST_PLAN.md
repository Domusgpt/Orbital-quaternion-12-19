# Frame Slicing Test Plan

## Current Problem

The AI generation is producing inconsistent results:
- **Ring 0 (pitch 0°)**: Should be eye-level, but getting mostly tilted frames except row 0 (N,S,E,W)
- **Ring 1 (pitch 30°)**: Should be elevated view, but getting proper eye-level rotations

The sheets appear to be backwards or mixed up.

---

## Test Approach

### Step 1: Create a Debug Test Sprite Sheet

Create a 1024x1024 PNG image with:
- 4x4 grid (16 cells, each 256x256)
- Each cell clearly labeled with:
  - Frame index (0-15)
  - Direction (N, S, E, W, NW, NE, etc.)
  - Angle (0°, 180°, 90°, etc.)
  - Distinct background color per cell

**Grid Layout (matching our quadrant system):**
```
Row 0: [0:N:0°]    [1:S:180°]   [2:E:90°]    [3:W:270°]
Row 1: [4:NW:315°] [5:NE:45°]   [6:SE:135°]  [7:SW:225°]
Row 2: [8:NNW:337.5°] [9:NNE:22.5°] [10:SSE:157.5°] [11:SSW:202.5°]
Row 3: [12:WNW:292.5°] [13:ENE:67.5°] [14:ESE:112.5°] [15:WSW:247.5°]
```

### Step 2: Load Test Image as Both Rings

Temporarily modify the app to:
1. Use the test image for both Ring 0 and Ring 1
2. This isolates the shader/slicing logic from AI generation issues

### Step 3: Manual Yaw Testing

Step through specific yaw angles and verify:

| Yaw (degrees) | Expected Frame A | Expected Frame B | Expected Blend |
|---------------|------------------|------------------|----------------|
| 0°            | 0 (N)            | 9 (NNE)          | 0%             |
| 11.25°        | 0 (N)            | 9 (NNE)          | 50%            |
| 22.5°         | 9 (NNE)          | 5 (NE)           | 0%             |
| 45°           | 5 (NE)           | 13 (ENE)         | 0%             |
| 90°           | 2 (E)            | 14 (ESE)         | 0%             |
| 180°          | 1 (S)            | 11 (SSW)         | 0%             |
| 270°          | 3 (W)            | 12 (WNW)         | 0%             |
| 337.5°        | 8 (NNW)          | 0 (N)            | 0%             |
| 350°          | 8 (NNW)          | 0 (N)            | ~55%           |

### Step 4: Verify Angular Sequence Lookup

The shader uses `getFrameIndex()` to map angle index to frame index:

```
Angle Index → Frame Index (from shader)
0  → 0   (N at 0°)
1  → 9   (NNE at 22.5°)
2  → 5   (NE at 45°)
3  → 13  (ENE at 67.5°)
4  → 2   (E at 90°)
5  → 14  (ESE at 112.5°)
6  → 6   (SE at 135°)
7  → 10  (SSE at 157.5°)
8  → 1   (S at 180°)
9  → 11  (SSW at 202.5°)
10 → 7   (SW at 225°)
11 → 15  (WSW at 247.5°)
12 → 3   (W at 270°)
13 → 12  (WNW at 292.5°)
14 → 4   (NW at 315°)
15 → 8   (NNW at 337.5°)
```

### Step 5: Verify UV Sampling

For frame index 0 (top-left cell):
- col = 0 % 4 = 0
- row = floor(0 / 4) = 0
- frameUV.x = (0 + uv.x) / 4 → range [0, 0.25]
- frameUV.y = (0 + (1 - uv.y)) / 4 → range [0, 0.25]

For frame index 5 (row 1, col 1):
- col = 5 % 4 = 1
- row = floor(5 / 4) = 1
- frameUV.x = (1 + uv.x) / 4 → range [0.25, 0.5]
- frameUV.y = (1 + (1 - uv.y)) / 4 → range [0.25, 0.5]

### Step 6: Document Findings

After testing, document:
1. Is the angular sequence lookup correct?
2. Is the UV sampling hitting the right cells?
3. Is the blend calculation correct?
4. What's actually broken vs working?

---

## Things to Check in Current Generation

1. **Why are Ring 0 and Ring 1 swapped?**
   - Is the prompt confusing the AI?
   - Are we assigning them to the wrong variables?

2. **Why does Ring 0 have mixed pitch frames?**
   - Is "eye-level" being interpreted differently per row?
   - Is the quadrant grouping confusing the pitch instruction?

3. **Why does Ring 1 have correct rotations at wrong pitch?**
   - Is the AI ignoring the pitch instruction?
   - Is it using the first sheet as reference and overriding pitch?

---

## Potential Fixes (DO NOT IMPLEMENT YET)

1. Swap the sheet assignments (pitch0 ↔ pitch30)
2. Change prompt to be more explicit about pitch per frame
3. Generate sheets sequentially with first as reference
4. Simplify to 8-frame turnstile first, get that working

---

## Next Steps

1. [ ] Create test sprite sheet image
2. [ ] Add code to load test image (temporary)
3. [ ] Step through yaw angles manually
4. [ ] Document what's actually happening
5. [ ] Then decide what to fix

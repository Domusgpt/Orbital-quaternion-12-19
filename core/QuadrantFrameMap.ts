/**
 * QuadrantFrameMap.ts
 *
 * Defines the frame system with logical hierarchy:
 * - Row 0-1: Main views (cardinals + intercardinals)
 * - Row 2-3: Offset views (+22.5° from main views)
 *
 * Grid Layout (4x4, 16 frames):
 * ┌─────────┬─────────┬─────────┬─────────┐
 * │ N (0°)  │ E (90°) │ S (180°)│ W (270°)│ Row 0: Cardinals
 * ├─────────┼─────────┼─────────┼─────────┤
 * │NE (45°) │SE (135°)│SW (225°)│NW (315°)│ Row 1: Intercardinals
 * ├─────────┼─────────┼─────────┼─────────┤
 * │ 22.5°   │ 112.5°  │ 202.5°  │ 292.5°  │ Row 2: Cardinal+22.5°
 * ├─────────┼─────────┼─────────┼─────────┤
 * │ 67.5°   │ 157.5°  │ 247.5°  │ 337.5°  │ Row 3: Intercardinal+22.5°
 * └─────────┴─────────┴─────────┴─────────┘
 */

export interface CompassFrame {
  direction: string;      // "N", "NNE", "NE", etc.
  angle: number;          // degrees 0-360
  gridRow: number;        // 0-3
  gridCol: number;        // 0-3
  frameIndex: number;     // gridRow * 4 + gridCol
}

/**
 * All 16 frames in GRID order (for generation and texture storage)
 */
export const QUADRANT_GRID: CompassFrame[] = [
  // Row 0: Cardinals (90° apart)
  { direction: 'N',   angle: 0,     gridRow: 0, gridCol: 0, frameIndex: 0 },
  { direction: 'E',   angle: 90,    gridRow: 0, gridCol: 1, frameIndex: 1 },
  { direction: 'S',   angle: 180,   gridRow: 0, gridCol: 2, frameIndex: 2 },
  { direction: 'W',   angle: 270,   gridRow: 0, gridCol: 3, frameIndex: 3 },
  // Row 1: Intercardinals (45° from cardinals)
  { direction: 'NE',  angle: 45,    gridRow: 1, gridCol: 0, frameIndex: 4 },
  { direction: 'SE',  angle: 135,   gridRow: 1, gridCol: 1, frameIndex: 5 },
  { direction: 'SW',  angle: 225,   gridRow: 1, gridCol: 2, frameIndex: 6 },
  { direction: 'NW',  angle: 315,   gridRow: 1, gridCol: 3, frameIndex: 7 },
  // Row 2: Cardinal offsets (+22.5°)
  { direction: 'NNE', angle: 22.5,  gridRow: 2, gridCol: 0, frameIndex: 8 },
  { direction: 'ESE', angle: 112.5, gridRow: 2, gridCol: 1, frameIndex: 9 },
  { direction: 'SSW', angle: 202.5, gridRow: 2, gridCol: 2, frameIndex: 10 },
  { direction: 'WNW', angle: 292.5, gridRow: 2, gridCol: 3, frameIndex: 11 },
  // Row 3: Intercardinal offsets (+22.5°)
  { direction: 'ENE', angle: 67.5,  gridRow: 3, gridCol: 0, frameIndex: 12 },
  { direction: 'SSE', angle: 157.5, gridRow: 3, gridCol: 1, frameIndex: 13 },
  { direction: 'WSW', angle: 247.5, gridRow: 3, gridCol: 2, frameIndex: 14 },
  { direction: 'NNW', angle: 337.5, gridRow: 3, gridCol: 3, frameIndex: 15 },
];

/**
 * Frame indices sorted by ANGULAR order (for smooth rotation stitching)
 * Maps: angle index (0-15, each representing 22.5°) → frame index
 *
 * Sequence: N(0°) → NNE(22.5°) → NE(45°) → ENE(67.5°) → E(90°) → ...
 */
export const ANGULAR_SEQUENCE: number[] = [
  0,   // Angle 0:   N     (0°)     - Row 0, Col 0
  8,   // Angle 1:   NNE   (22.5°)  - Row 2, Col 0
  4,   // Angle 2:   NE    (45°)    - Row 1, Col 0
  12,  // Angle 3:   ENE   (67.5°)  - Row 3, Col 0
  1,   // Angle 4:   E     (90°)    - Row 0, Col 1
  9,   // Angle 5:   ESE   (112.5°) - Row 2, Col 1
  5,   // Angle 6:   SE    (135°)   - Row 1, Col 1
  13,  // Angle 7:   SSE   (157.5°) - Row 3, Col 1
  2,   // Angle 8:   S     (180°)   - Row 0, Col 2
  10,  // Angle 9:   SSW   (202.5°) - Row 2, Col 2
  6,   // Angle 10:  SW    (225°)   - Row 1, Col 2
  14,  // Angle 11:  WSW   (247.5°) - Row 3, Col 2
  3,   // Angle 12:  W     (270°)   - Row 0, Col 3
  11,  // Angle 13:  WNW   (292.5°) - Row 2, Col 3
  7,   // Angle 14:  NW    (315°)   - Row 1, Col 3
  15,  // Angle 15:  NNW   (337.5°) - Row 3, Col 3
];

/**
 * Reverse lookup: frame index → position in angular sequence
 * Used to find where a frame sits in the rotation order
 */
export const FRAME_TO_ANGLE_INDEX: number[] = (() => {
  const result = new Array(16);
  ANGULAR_SEQUENCE.forEach((frameIdx, angleIdx) => {
    result[frameIdx] = angleIdx;
  });
  return result;
})();

/**
 * Compass direction labels in angular order (for UI display)
 */
export const ANGULAR_LABELS: string[] = [
  'N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE',
  'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'
];

/**
 * Get the two frame indices and blend factor for smooth interpolation
 * at a given yaw angle.
 *
 * @param yawDegrees - Current yaw angle in degrees (0-360, can be negative)
 * @returns Object with frameA, frameB (indices into the 4x4 grid), and blend factor
 */
export function getBlendFrames(yawDegrees: number): {
  frameA: number;
  frameB: number;
  blend: number;
  angleIndexA: number;
  angleIndexB: number;
} {
  // Normalize to 0-360
  const yaw = ((yawDegrees % 360) + 360) % 360;

  // Each of 16 frames covers 22.5° (360/16)
  const angleFloat = yaw / 22.5;
  const angleIndexA = Math.floor(angleFloat) % 16;
  const angleIndexB = (angleIndexA + 1) % 16;
  const blend = angleFloat - Math.floor(angleFloat);

  return {
    frameA: ANGULAR_SEQUENCE[angleIndexA],
    frameB: ANGULAR_SEQUENCE[angleIndexB],
    blend,
    angleIndexA,
    angleIndexB
  };
}

/**
 * Get the compass direction label for a given yaw angle
 *
 * @param yawDegrees - Current yaw angle in degrees
 * @returns Compass direction string (e.g., "NNE", "SW")
 */
export function getCompassDirection(yawDegrees: number): string {
  const yaw = ((yawDegrees % 360) + 360) % 360;
  const angleIndex = Math.round(yaw / 22.5) % 16;
  return ANGULAR_LABELS[angleIndex];
}

/**
 * Convert frame index to grid UV offset
 * Used for sampling a specific frame from the 4x4 texture atlas
 *
 * @param frameIndex - Frame index (0-15)
 * @returns Grid column and row for UV calculation
 */
export function frameToGridPosition(frameIndex: number): { col: number; row: number } {
  return {
    col: frameIndex % 4,
    row: Math.floor(frameIndex / 4)
  };
}

/**
 * Get angle in degrees for a given frame index
 *
 * @param frameIndex - Frame index (0-15)
 * @returns Angle in degrees
 */
export function frameToAngle(frameIndex: number): number {
  const frame = QUADRANT_GRID.find(f => f.frameIndex === frameIndex);
  return frame ? frame.angle : 0;
}

/**
 * Constants for shader uniform generation
 */
export const GRID_COLS = 4;
export const GRID_ROWS = 4;
export const TOTAL_FRAMES = 16;
export const DEGREES_PER_FRAME = 22.5;

/**
 * Generate GLSL-compatible angular sequence array string
 * For embedding in shader code
 */
export function getGLSLAngularSequence(): string {
  return `float[16](${ANGULAR_SEQUENCE.map(n => n.toFixed(1)).join(', ')})`;
}

import { ANGULAR_SEQUENCE, GRID_COLS, GRID_ROWS } from "../QuadrantFrameMap";

export class OrbitalShaderManager {
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  public program: WebGLProgram | null = null;

  constructor(gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.gl = gl;
  }

  /**
   * Get the angular sequence as a Float32Array for uniform upload
   */
  static getAngularSequenceArray(): Float32Array {
    return new Float32Array(ANGULAR_SEQUENCE);
  }

  createProgram(): WebGLProgram | null {
    // Clean vertex shader - no distortion effects for stable display
    const vertexSource = `
      precision highp float;

      attribute vec2 a_position;
      varying vec2 v_uv;

      void main() {
        // Simple UV mapping - no distortion
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // Fragment shader with smooth frame blending and motion effects
    const fragmentSource = `
      precision highp float;

      varying vec2 v_uv;

      uniform sampler2D u_textureRing0;
      uniform sampler2D u_textureRing1;

      uniform float u_yaw;
      uniform float u_pitch;
      uniform float u_velocity;
      uniform float u_renderMode; // 0 = orbital (with pitch), 1 = turnstile (single axis)

      // Constants
      const float PI = 3.14159265359;
      const float TWO_PI = 6.28318530718;
      const float GRID_COLS = 4.0;
      const float GRID_ROWS = 4.0;
      const float FRAMES_PER_SHEET = 16.0;
      const float TOTAL_FRAMES_32 = 32.0;
      const float DEGREES_PER_FRAME_16 = 22.5;  // For 16-frame mode
      const float DEGREES_PER_FRAME_32 = 11.25; // For 32-frame mode (interleaved)

      /**
       * Angular sequence lookup: maps angle index (0-15) to frame index in quadrant grid
       * Frame layout follows compass quadrant grouping:
       * Row 0: N(0), S(1), E(2), W(3)        - Cardinals
       * Row 1: NW(4), NE(5), SE(6), SW(7)    - Intercardinals
       * Row 2: NNW(8), NNE(9), SSE(10), SSW(11) - Fine N/S
       * Row 3: WNW(12), ENE(13), ESE(14), WSW(15) - Fine E/W
       *
       * Angular order: N→NNE→NE→ENE→E→ESE→SE→SSE→S→SSW→SW→WSW→W→WNW→NW→NNW
       */
      float getFrameIndex(int angleIndex) {
        int idx = int(mod(float(angleIndex), 16.0));

        if (idx == 0) return 0.0;   // N (0°)
        if (idx == 1) return 9.0;   // NNE (22.5°)
        if (idx == 2) return 5.0;   // NE (45°)
        if (idx == 3) return 13.0;  // ENE (67.5°)
        if (idx == 4) return 2.0;   // E (90°)
        if (idx == 5) return 14.0;  // ESE (112.5°)
        if (idx == 6) return 6.0;   // SE (135°)
        if (idx == 7) return 10.0;  // SSE (157.5°)
        if (idx == 8) return 1.0;   // S (180°)
        if (idx == 9) return 11.0;  // SSW (202.5°)
        if (idx == 10) return 7.0;  // SW (225°)
        if (idx == 11) return 15.0; // WSW (247.5°)
        if (idx == 12) return 3.0;  // W (270°)
        if (idx == 13) return 12.0; // WNW (292.5°)
        if (idx == 14) return 4.0;  // NW (315°)
        return 8.0;                 // NNW (337.5°)
      }

      /**
       * Sample a frame from the 4x4 quadrant grid
       * Grid layout: row 0 at top of texture, row 3 at bottom
       */
      vec4 sampleFrame(sampler2D tex, float frameIndex, vec2 uv) {
        float col = mod(frameIndex, GRID_COLS);
        float row = floor(frameIndex / GRID_COLS);

        // UV mapping:
        // - col maps to X: (col + uv.x) / 4
        // - row maps to Y: row 0 = top of texture (Y near 0)
        // - uv.y=0 is display bottom, uv.y=1 is display top
        // - For right-side-up: display top should sample texture top of cell
        vec2 frameUV = vec2(
          (col + uv.x) / GRID_COLS,
          (row + (1.0 - uv.y)) / GRID_ROWS
        );

        return texture2D(tex, frameUV);
      }

      /**
       * Sample with slight UV offset for motion blur effect
       */
      vec4 sampleFrameBlurred(sampler2D tex, float frameIndex, vec2 uv, float blurAmount) {
        vec4 center = sampleFrame(tex, frameIndex, uv);

        if (abs(blurAmount) < 0.01) {
          return center;
        }

        // Sample offset positions for horizontal motion blur
        vec2 offset = vec2(blurAmount * 0.02, 0.0);
        vec4 left = sampleFrame(tex, frameIndex, uv - offset);
        vec4 right = sampleFrame(tex, frameIndex, uv + offset);

        // Weighted blend for motion blur
        return center * 0.5 + left * 0.25 + right * 0.25;
      }

      /**
       * Smooth interpolation with ease-in-out curve
       * Makes frame transitions feel more natural
       */
      float smoothBlend(float t) {
        // Hermite interpolation (smoothstep)
        return t * t * (3.0 - 2.0 * t);
      }

      /**
       * Even smoother interpolation for very fluid motion
       */
      float smootherBlend(float t) {
        // Ken Perlin's smootherstep
        return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
      }

      void main() {
        // Convert yaw (radians) to degrees, normalize to 0-360
        float yawDeg = u_yaw * 57.2957795131; // 180/PI
        yawDeg = mod(yawDeg + 360.0, 360.0);

        // Velocity-based motion enhancement
        float absVelocity = abs(u_velocity);
        float motionBlur = absVelocity * 0.05;

        vec4 finalColor;

        if (u_renderMode < 0.5) {
          // ORBITAL MODE: 16 frames per sheet, pitch blending between sheets
          float angleFloat = yawDeg / DEGREES_PER_FRAME_16;
          int angleIndexA = int(floor(angleFloat));
          int angleIndexB = int(mod(float(angleIndexA + 1), FRAMES_PER_SHEET));

          float frameA = getFrameIndex(angleIndexA);
          float frameB = getFrameIndex(angleIndexB);

          float rawBlend = fract(angleFloat);
          float blend = smootherBlend(rawBlend);

          // Sample from both sheets
          vec4 color0A = sampleFrameBlurred(u_textureRing0, frameA, v_uv, motionBlur);
          vec4 color0B = sampleFrameBlurred(u_textureRing0, frameB, v_uv, motionBlur);
          vec4 color0 = mix(color0A, color0B, blend);

          vec4 color1A = sampleFrameBlurred(u_textureRing1, frameA, v_uv, motionBlur);
          vec4 color1B = sampleFrameBlurred(u_textureRing1, frameB, v_uv, motionBlur);
          vec4 color1 = mix(color1A, color1B, blend);

          // Pitch blending (0-30° range)
          float pitchNorm = clamp(u_pitch / 30.0, 0.0, 1.0);
          float pitchBlend = smoothBlend(pitchNorm);
          finalColor = mix(color0, color1, pitchBlend);

        } else {
          // TURNSTILE MODE: 32 frames total (interleaved from both sheets)
          // Sheet 0: frames at 0°, 22.5°, 45°, ... (even indices)
          // Sheet 1: frames at 11.25°, 33.75°, ... (odd indices, offset by 11.25°)
          float angleFloat32 = yawDeg / DEGREES_PER_FRAME_32;
          int globalIndex = int(floor(angleFloat32));
          int nextIndex = int(mod(float(globalIndex + 1), TOTAL_FRAMES_32));

          // Determine which sheet each frame comes from (even=sheet0, odd=sheet1)
          bool frameAFromSheet1 = mod(float(globalIndex), 2.0) > 0.5;
          bool frameBFromSheet1 = mod(float(nextIndex), 2.0) > 0.5;

          // Convert global 32-index to local 16-index for each sheet
          int localIndexA = globalIndex / 2;
          int localIndexB = nextIndex / 2;

          float frameA = getFrameIndex(localIndexA);
          float frameB = getFrameIndex(localIndexB);

          float rawBlend = fract(angleFloat32);
          float blend = smootherBlend(rawBlend);

          // Sample from appropriate sheets
          vec4 colorA = frameAFromSheet1
            ? sampleFrameBlurred(u_textureRing1, frameA, v_uv, motionBlur)
            : sampleFrameBlurred(u_textureRing0, frameA, v_uv, motionBlur);

          vec4 colorB = frameBFromSheet1
            ? sampleFrameBlurred(u_textureRing1, frameB, v_uv, motionBlur)
            : sampleFrameBlurred(u_textureRing0, frameB, v_uv, motionBlur);

          finalColor = mix(colorA, colorB, blend);
        }

        // Alpha handling for white backgrounds
        float lum = dot(finalColor.rgb, vec3(0.299, 0.587, 0.114));
        if (lum > 0.97) {
          finalColor.a = 0.0;
        }

        gl_FragColor = finalColor;
      }
    `;

    const vertexShader = this.compileShader(vertexSource, this.gl.VERTEX_SHADER);
    const fragmentShader = this.compileShader(fragmentSource, this.gl.FRAGMENT_SHADER);

    if (!vertexShader || !fragmentShader) {
      return null;
    }

    const program = this.gl.createProgram();
    if (!program) {
      return null;
    }

    this.gl.attachShader(program, vertexShader);
    this.gl.attachShader(program, fragmentShader);
    this.gl.linkProgram(program);

    if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
      console.error("Orbital shader link error:", this.gl.getProgramInfoLog(program));
      return null;
    }

    this.program = program;
    return program;
  }

  private compileShader(source: string, type: number): WebGLShader | null {
    const shader = this.gl.createShader(type);
    if (!shader) {
      return null;
    }

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error("Orbital shader compile error:", this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }

    return shader;
  }
}

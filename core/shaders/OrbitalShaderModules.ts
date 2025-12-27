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

    // Fragment shader with quadrant-based 4x4 grid and angular sequence lookup
    const fragmentSource = `
      precision highp float;

      varying vec2 v_uv;

      uniform sampler2D u_textureRing0;
      uniform sampler2D u_textureRing1;

      uniform float u_yaw;
      uniform float u_pitch;
      uniform float u_velocity;
      uniform float u_renderMode; // 0 = orbital (16 frames), 1 = turnstile (8 frames)

      // Angular sequence lookup: maps angle index (0-15) to frame index
      // Frame indices are NOT sequential - they follow compass quadrant grouping:
      // Row 0: N(0), S(1), E(2), W(3)        - Cardinals
      // Row 1: NW(4), NE(5), SE(6), SW(7)    - Intercardinals
      // Row 2: NNW(8), NNE(9), SSE(10), SSW(11) - Fine N/S
      // Row 3: WNW(12), ENE(13), ESE(14), WSW(15) - Fine E/W
      //
      // Angular order: N→NNE→NE→ENE→E→ESE→SE→SSE→S→SSW→SW→WSW→W→WNW→NW→NNW
      // Which maps to frame indices: 0,9,5,13,2,14,6,10,1,11,7,15,3,12,4,8
      // NOTE: Array initialization removed for WebGL1 compatibility - using getAngularFrame() instead

      const float PI = 3.14159265359;
      const float TWO_PI = 6.28318530718;
      const float GRID_COLS = 4.0;
      const float GRID_ROWS = 4.0;
      const float TOTAL_FRAMES = 16.0;
      const float DEGREES_PER_FRAME = 22.5;

      /**
       * Sample a frame from the 4x4 quadrant grid
       * frameIndex: 0-15, where row = floor(frameIndex/4), col = mod(frameIndex,4)
       */
      vec4 sampleQuadrantFrame(sampler2D tex, float frameIndex, vec2 uv) {
        float col = mod(frameIndex, GRID_COLS);
        float row = floor(frameIndex / GRID_COLS);

        vec2 finalUV = vec2(
          (col + uv.x) / GRID_COLS,
          1.0 - ((row + (1.0 - uv.y)) / GRID_ROWS)
        );

        return texture2D(tex, finalUV);
      }

      /**
       * Get frame index for 16-frame ORBITAL mode (quadrant layout)
       * WebGL1 compatible - uses if-else chain for array access
       */
      float getOrbitalFrame(int angleIndex) {
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
       * Get frame index for 8-frame TURNSTILE mode (simple sequential)
       * Uses first 2 rows of quadrant grid (cardinals + intercardinals)
       * Angular order: N(0°) → NE(45°) → E(90°) → SE(135°) → S(180°) → SW(225°) → W(270°) → NW(315°)
       */
      float getTurnstileFrame(int angleIndex) {
        int idx = int(mod(float(angleIndex), 8.0));

        if (idx == 0) return 0.0;  // N (0°) - row 0, col 0
        if (idx == 1) return 5.0;  // NE (45°) - row 1, col 1
        if (idx == 2) return 2.0;  // E (90°) - row 0, col 2
        if (idx == 3) return 6.0;  // SE (135°) - row 1, col 2
        if (idx == 4) return 1.0;  // S (180°) - row 0, col 1
        if (idx == 5) return 7.0;  // SW (225°) - row 1, col 3
        if (idx == 6) return 3.0;  // W (270°) - row 0, col 3
        return 4.0;                // NW (315°) - row 1, col 0
      }

      void main() {
        // Convert yaw (radians) to degrees, normalize to 0-360
        float yawDeg = u_yaw * 57.2957795131; // 180/PI
        yawDeg = mod(yawDeg, 360.0);
        if (yawDeg < 0.0) {
          yawDeg += 360.0;
        }

        // Calculate frame indices based on render mode
        float frameA;
        float frameB;
        float interp;

        if (u_renderMode < 0.5) {
          // ORBITAL MODE: 16 frames, 22.5° each
          float angleFloat = yawDeg / 22.5;
          int angleIndexA = int(floor(angleFloat));
          int angleIndexB = int(mod(float(angleIndexA + 1), 16.0));
          frameA = getOrbitalFrame(angleIndexA);
          frameB = getOrbitalFrame(angleIndexB);
          interp = fract(angleFloat);
        } else {
          // TURNSTILE MODE: 8 frames, 45° each
          float angleFloat = yawDeg / 45.0;
          int angleIndexA = int(floor(angleFloat));
          int angleIndexB = int(mod(float(angleIndexA + 1), 8.0));
          frameA = getTurnstileFrame(angleIndexA);
          frameB = getTurnstileFrame(angleIndexB);
          interp = fract(angleFloat);
        }

        // Minimal velocity-based motion blur (velocity is now clamped to -3..3)
        float velocityBlur = clamp(abs(u_velocity) * 0.05, 0.0, 0.15);
        float blend = clamp(interp + velocityBlur, 0.0, 1.0);

        // Sample and blend frames from Ring 0 (pitch 0°)
        vec4 color0A = sampleQuadrantFrame(u_textureRing0, frameA, v_uv);
        vec4 color0B = sampleQuadrantFrame(u_textureRing0, frameB, v_uv);
        vec4 color0 = mix(color0A, color0B, blend);

        vec4 finalColor;
        if (u_renderMode < 0.5) {
          // ORBITAL MODE: blend with pitch ring
          vec4 color1A = sampleQuadrantFrame(u_textureRing1, frameA, v_uv);
          vec4 color1B = sampleQuadrantFrame(u_textureRing1, frameB, v_uv);
          vec4 color1 = mix(color1A, color1B, blend);
          float pitchBlend = clamp(u_pitch / 30.0, 0.0, 1.0);
          finalColor = mix(color0, color1, pitchBlend);
        } else {
          // TURNSTILE MODE: no pitch blending, just ring 0
          finalColor = color0;
        }

        // Remove pure white background (luminance > 0.98)
        float lum = dot(finalColor.rgb, vec3(0.299, 0.587, 0.114));
        if (lum > 0.98) {
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

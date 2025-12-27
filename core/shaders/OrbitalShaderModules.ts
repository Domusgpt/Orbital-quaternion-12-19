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
      const float TOTAL_FRAMES = 16.0;
      const float DEGREES_PER_FRAME = 22.5;

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
       */
      vec4 sampleFrame(sampler2D tex, float frameIndex, vec2 uv) {
        float col = mod(frameIndex, GRID_COLS);
        float row = floor(frameIndex / GRID_COLS);

        vec2 frameUV = vec2(
          (col + uv.x) / GRID_COLS,
          1.0 - ((row + (1.0 - uv.y)) / GRID_ROWS)
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

        // Calculate which frames to blend (always 16 frames, 22.5° each)
        float angleFloat = yawDeg / DEGREES_PER_FRAME;
        int angleIndexA = int(floor(angleFloat));
        int angleIndexB = int(mod(float(angleIndexA + 1), TOTAL_FRAMES));

        // Get actual frame indices from quadrant layout
        float frameA = getFrameIndex(angleIndexA);
        float frameB = getFrameIndex(angleIndexB);

        // Calculate blend factor with smooth interpolation
        float rawBlend = fract(angleFloat);
        float blend = smootherBlend(rawBlend);

        // Velocity-based motion enhancement
        float absVelocity = abs(u_velocity);
        float motionBlur = absVelocity * 0.5; // Motion blur amount

        // When spinning fast, bias blend toward direction of motion
        float velocityBias = 0.0;
        if (absVelocity > 0.5) {
          velocityBias = sign(u_velocity) * min(absVelocity * 0.1, 0.2);
        }
        blend = clamp(blend + velocityBias, 0.0, 1.0);

        // Sample frames with motion blur
        vec4 colorA = sampleFrameBlurred(u_textureRing0, frameA, v_uv, motionBlur);
        vec4 colorB = sampleFrameBlurred(u_textureRing0, frameB, v_uv, motionBlur);

        // Smooth cross-fade between frames
        vec4 color0 = mix(colorA, colorB, blend);

        vec4 finalColor;

        if (u_renderMode < 0.5) {
          // ORBITAL MODE: Blend with pitch ring for vertical angle
          vec4 color1A = sampleFrameBlurred(u_textureRing1, frameA, v_uv, motionBlur);
          vec4 color1B = sampleFrameBlurred(u_textureRing1, frameB, v_uv, motionBlur);
          vec4 color1 = mix(color1A, color1B, blend);

          // Smooth pitch blending (0-30° range)
          float pitchNorm = clamp(u_pitch / 30.0, 0.0, 1.0);
          float pitchBlend = smoothBlend(pitchNorm);
          finalColor = mix(color0, color1, pitchBlend);
        } else {
          // TURNSTILE MODE: Single axis, no pitch blending
          finalColor = color0;
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

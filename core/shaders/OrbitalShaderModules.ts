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
    const vertexSource = `
      precision highp float;

      attribute vec2 a_position;
      varying vec2 v_uv;

      uniform float u_velocity;
      uniform float u_warpFactor;
      uniform float u_pitch;

      void main() {
        v_uv = a_position * 0.5 + 0.5;

        vec3 pos = vec3(a_position, 0.0);

        float inertialShear = u_velocity * 0.15;
        pos.x += pos.y * inertialShear;

        float cylinderCurve = cos(pos.x * 1.5) * u_warpFactor;
        pos.z -= cylinderCurve;

        float pitchRad = u_pitch * 0.0174533;
        float originalY = pos.y;
        pos.y = originalY * cos(pitchRad) + pos.z * sin(pitchRad);
        pos.z = pos.z * cos(pitchRad) - originalY * sin(pitchRad);

        gl_Position = vec4(pos, 1.0);
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

      // Angular sequence lookup: maps angle index (0-15) to frame index
      // Frame indices are NOT sequential - they follow compass quadrant grouping:
      // Row 0: N(0), S(1), E(2), W(3)        - Cardinals
      // Row 1: NW(4), NE(5), SE(6), SW(7)    - Intercardinals
      // Row 2: NNW(8), NNE(9), SSE(10), SSW(11) - Fine N/S
      // Row 3: WNW(12), ENE(13), ESE(14), WSW(15) - Fine E/W
      //
      // Angular order: N→NNE→NE→ENE→E→ESE→SE→SSE→S→SSW→SW→WSW→W→WNW→NW→NNW
      // Which maps to frame indices: 0,9,5,13,2,14,6,10,1,11,7,15,3,12,4,8
      const float ANGULAR_SEQ[16] = float[16](
        0.0,  // Angle 0:  N     (0°)
        9.0,  // Angle 1:  NNE   (22.5°)
        5.0,  // Angle 2:  NE    (45°)
        13.0, // Angle 3:  ENE   (67.5°)
        2.0,  // Angle 4:  E     (90°)
        14.0, // Angle 5:  ESE   (112.5°)
        6.0,  // Angle 6:  SE    (135°)
        10.0, // Angle 7:  SSE   (157.5°)
        1.0,  // Angle 8:  S     (180°)
        11.0, // Angle 9:  SSW   (202.5°)
        7.0,  // Angle 10: SW    (225°)
        15.0, // Angle 11: WSW   (247.5°)
        3.0,  // Angle 12: W     (270°)
        12.0, // Angle 13: WNW   (292.5°)
        4.0,  // Angle 14: NW    (315°)
        8.0   // Angle 15: NNW   (337.5°)
      );

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
       * Get frame index from angular sequence using indexing
       * WebGL1 compatible - uses if-else chain for array access
       */
      float getAngularFrame(int angleIndex) {
        // Wrap to 0-15
        int idx = int(mod(float(angleIndex), 16.0));

        if (idx == 0) return 0.0;
        if (idx == 1) return 9.0;
        if (idx == 2) return 5.0;
        if (idx == 3) return 13.0;
        if (idx == 4) return 2.0;
        if (idx == 5) return 14.0;
        if (idx == 6) return 6.0;
        if (idx == 7) return 10.0;
        if (idx == 8) return 1.0;
        if (idx == 9) return 11.0;
        if (idx == 10) return 7.0;
        if (idx == 11) return 15.0;
        if (idx == 12) return 3.0;
        if (idx == 13) return 12.0;
        if (idx == 14) return 4.0;
        return 8.0; // idx == 15
      }

      void main() {
        // Convert yaw (radians) to degrees, normalize to 0-360
        float yawDeg = u_yaw * 57.2957795131; // 180/PI
        yawDeg = mod(yawDeg, 360.0);
        if (yawDeg < 0.0) {
          yawDeg += 360.0;
        }

        // Calculate which angle index we're at (0-15, each covers 22.5°)
        float angleFloat = yawDeg / DEGREES_PER_FRAME;
        int angleIndexA = int(floor(angleFloat));
        int angleIndexB = int(mod(float(angleIndexA + 1), 16.0));

        // Get the actual frame indices from the angular sequence
        float frameA = getAngularFrame(angleIndexA);
        float frameB = getAngularFrame(angleIndexB);

        // Calculate blend factor between the two frames
        float interp = fract(angleFloat);

        // Add velocity-based motion blur for smoother animation
        float velocityBlur = clamp(abs(u_velocity) * 0.12, 0.0, 0.6);
        float blend = clamp(interp + velocityBlur, 0.0, 1.0);

        // Sample and blend frames from Ring 0 (pitch 0°)
        vec4 color0A = sampleQuadrantFrame(u_textureRing0, frameA, v_uv);
        vec4 color0B = sampleQuadrantFrame(u_textureRing0, frameB, v_uv);
        vec4 color0 = mix(color0A, color0B, blend);

        // Sample and blend frames from Ring 1 (pitch 30°)
        vec4 color1A = sampleQuadrantFrame(u_textureRing1, frameA, v_uv);
        vec4 color1B = sampleQuadrantFrame(u_textureRing1, frameB, v_uv);
        vec4 color1 = mix(color1A, color1B, blend);

        // Blend between pitch rings based on current pitch angle
        float pitchBlend = clamp(u_pitch / 30.0, 0.0, 1.0);
        vec4 finalColor = mix(color0, color1, pitchBlend);

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

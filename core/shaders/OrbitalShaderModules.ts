export class OrbitalShaderManager {
  private gl: WebGLRenderingContext | WebGL2RenderingContext;
  public program: WebGLProgram | null = null;

  constructor(gl: WebGLRenderingContext | WebGL2RenderingContext) {
    this.gl = gl;
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

    const fragmentSource = `
      precision highp float;

      varying vec2 v_uv;

      uniform sampler2D u_textureRing0;
      uniform sampler2D u_textureRing1;

      uniform float u_yaw;
      uniform float u_pitch;
      uniform float u_velocity;

      const float PI = 3.14159265359;

      vec4 sampleGridFrame(sampler2D tex, float frameIndex, vec2 uv) {
        float col = mod(frameIndex, 4.0);
        float row = floor(frameIndex / 4.0);

        vec2 finalUV = vec2(
          (col + uv.x) / 4.0,
          1.0 - ((row + (1.0 - uv.y)) / 2.0)
        );

        return texture2D(tex, finalUV);
      }

      void main() {
        float normAngle = fract(u_yaw / (2.0 * PI));
        if (normAngle < 0.0) {
          normAngle += 1.0;
        }

        float frameFloat = normAngle * 8.0;
        float frameIndex = floor(frameFloat);
        float interp = fract(frameFloat);
        float nextIndex = mod(frameIndex + 1.0, 8.0);

        float velocityBlur = clamp(abs(u_velocity) * 0.12, 0.0, 0.6);
        float blend = clamp(interp + velocityBlur, 0.0, 1.0);

        vec4 color0A = sampleGridFrame(u_textureRing0, frameIndex, v_uv);
        vec4 color0B = sampleGridFrame(u_textureRing0, nextIndex, v_uv);
        vec4 color0 = mix(color0A, color0B, blend);

        vec4 color1A = sampleGridFrame(u_textureRing1, frameIndex, v_uv);
        vec4 color1B = sampleGridFrame(u_textureRing1, nextIndex, v_uv);
        vec4 color1 = mix(color1A, color1B, blend);

        float blendFactor = clamp(u_pitch / 30.0, 0.0, 1.0);
        vec4 finalColor = mix(color0, color1, blendFactor);

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

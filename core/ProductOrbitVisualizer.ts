import { OrbitalShaderManager } from "./shaders/OrbitalShaderModules";
import { Quaternion, toAxisAngle } from "./quaternion";
import { getBlendFrames, getCompassDirection, ANGULAR_SEQUENCE } from "./QuadrantFrameMap";

export type OrbitalTextures = {
  ring0: HTMLImageElement;
  ring1: HTMLImageElement;
};

export type RenderMode = 'orbital' | 'turnstile';

export type DebugInfo = {
  yawRad: number;
  yawDeg: number;
  pitch: number;
  velocity: number;
  warpFactor: number;
  frameA: number;
  frameB: number;
  blendFactor: number;
  compassDirection: string;
  webglVersion: string;
  textureSize: { ring0: string; ring1: string };
  renderMode: RenderMode;
};

export class ProductOrbitVisualizer {
  private canvas: HTMLCanvasElement;
  private textures: OrbitalTextures;
  private gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private shaderManager: OrbitalShaderManager | null = null;
  private buffer: WebGLBuffer | null = null;
  private supported = false;
  private webglVersion = "none";
  private uniforms: {
    yaw: WebGLUniformLocation | null;
    pitch: WebGLUniformLocation | null;
    velocity: WebGLUniformLocation | null;
    warp: WebGLUniformLocation | null;
    textureRing0: WebGLUniformLocation | null;
    textureRing1: WebGLUniformLocation | null;
    renderMode: WebGLUniformLocation | null;
  } | null = null;

  private currentYaw = 0;
  private currentPitch = 0;
  private velocity = 0;
  private renderMode: RenderMode = 'orbital';

  constructor(canvas: HTMLCanvasElement, textures: OrbitalTextures) {
    this.canvas = canvas;
    this.textures = textures;
    this.initWebGL();
  }

  /**
   * Set render mode: 'orbital' (16-frame 4x4) or 'turnstile' (8-frame 4x2)
   */
  setRenderMode(mode: RenderMode) {
    this.renderMode = mode;
    // Reset pitch to 0 in turnstile mode (single axis)
    if (mode === 'turnstile') {
      this.currentPitch = 0;
    }
  }

  getRenderMode(): RenderMode {
    return this.renderMode;
  }

  isSupported() {
    return this.supported;
  }

  private initWebGL() {
    const gl2 = this.canvas.getContext("webgl2");
    if (gl2) {
      this.gl = gl2;
      this.webglVersion = "WebGL2";
    } else {
      const gl1 = this.canvas.getContext("webgl");
      if (gl1) {
        this.gl = gl1;
        this.webglVersion = "WebGL1";
      }
    }

    if (!this.gl) {
      this.webglVersion = "none";
      return;
    }

    this.shaderManager = new OrbitalShaderManager(this.gl);
    this.program = this.shaderManager.createProgram();

    if (!this.program) {
      return;
    }

    this.supported = true;

    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    this.buffer = this.gl.createBuffer();
    if (!this.buffer) {
      return;
    }

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, positions, this.gl.STATIC_DRAW);

    this.uploadTexture(this.textures.ring0, 0);
    this.uploadTexture(this.textures.ring1, 1);

    this.uniforms = {
      yaw: this.gl.getUniformLocation(this.program, "u_yaw"),
      pitch: this.gl.getUniformLocation(this.program, "u_pitch"),
      velocity: this.gl.getUniformLocation(this.program, "u_velocity"),
      warp: this.gl.getUniformLocation(this.program, "u_warpFactor"),
      textureRing0: this.gl.getUniformLocation(this.program, "u_textureRing0"),
      textureRing1: this.gl.getUniformLocation(this.program, "u_textureRing1"),
      renderMode: this.gl.getUniformLocation(this.program, "u_renderMode")
    };
  }

  private uploadTexture(image: HTMLImageElement, unit: number) {
    if (!this.gl) {
      return;
    }

    const tex = this.gl.createTexture();
    if (!tex) {
      return;
    }

    this.gl.activeTexture(this.gl.TEXTURE0 + unit);
    this.gl.bindTexture(this.gl.TEXTURE_2D, tex);
    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      image
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      this.gl.LINEAR
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MAG_FILTER,
      this.gl.LINEAR
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_S,
      this.gl.CLAMP_TO_EDGE
    );
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_WRAP_T,
      this.gl.CLAMP_TO_EDGE
    );
  }

  setSize(width: number, height: number) {
    if (!this.gl) {
      return;
    }

    this.canvas.width = width;
    this.canvas.height = height;
    this.gl.viewport(0, 0, width, height);
  }

  updateFromRotor(quaternion: Quaternion, dt: number) {
    const { axis, angle } = toAxisAngle(quaternion);

    const yEnergy = axis[1] * angle;
    const xEnergy = axis[0] * angle;

    this.currentYaw += yEnergy * 0.1;

    const fullTurn = Math.PI * 2;
    this.currentYaw = ((this.currentYaw % fullTurn) + fullTurn) % fullTurn;

    // Pitch only changes in orbital mode
    if (this.renderMode === 'orbital') {
      this.currentPitch += xEnergy * 5.0;
      this.currentPitch = Math.max(0, Math.min(30, this.currentPitch));
    } else {
      // Turnstile mode: single axis, no pitch
      this.currentPitch = 0;
    }

    // Calculate velocity with proper clamping to prevent extreme values
    const velocityScale = dt > 0 ? 1 / dt : 1;
    const instantaneousVelocity = yEnergy * velocityScale;
    // Smooth velocity with stronger damping
    this.velocity = this.velocity * 0.9 + instantaneousVelocity * 0.1;
    // CLAMP velocity to sane bounds to prevent spaghetti distortion
    this.velocity = Math.max(-3, Math.min(3, this.velocity));
  }

  render() {
    if (!this.gl || !this.program || !this.buffer || !this.uniforms) {
      return;
    }

    this.gl.clearColor(1, 1, 1, 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    this.gl.useProgram(this.program);

    // Disable warp effect entirely for stable display
    const warpFactor = 0;
    // Clamp velocity for shader (already clamped but be safe)
    const clampedVelocity = Math.max(-3, Math.min(3, this.velocity));

    this.gl.uniform1f(this.uniforms.yaw, this.currentYaw);
    this.gl.uniform1f(this.uniforms.pitch, this.currentPitch);
    this.gl.uniform1f(this.uniforms.velocity, clampedVelocity);
    this.gl.uniform1f(this.uniforms.warp, warpFactor);
    this.gl.uniform1f(this.uniforms.renderMode, this.renderMode === 'orbital' ? 0.0 : 1.0);

    this.gl.uniform1i(this.uniforms.textureRing0, 0);
    this.gl.uniform1i(this.uniforms.textureRing1, 1);

    const posLoc = this.gl.getAttribLocation(this.program, "a_position");
    this.gl.enableVertexAttribArray(posLoc);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
    this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 0, 0);

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }

  /**
   * Get current debug information for the debug panel
   */
  getDebugInfo(): DebugInfo {
    const yawDeg = (this.currentYaw * 180) / Math.PI;
    const { frameA, frameB, blend } = getBlendFrames(yawDeg);
    // Warp is disabled, velocity is clamped
    const warpFactor = 0;

    return {
      yawRad: this.currentYaw,
      yawDeg: yawDeg,
      pitch: this.currentPitch,
      velocity: this.velocity, // Already clamped to -3..3
      warpFactor,
      frameA,
      frameB,
      blendFactor: blend,
      compassDirection: getCompassDirection(yawDeg),
      webglVersion: this.webglVersion,
      textureSize: {
        ring0: `${this.textures.ring0.width}x${this.textures.ring0.height}`,
        ring1: `${this.textures.ring1.width}x${this.textures.ring1.height}`,
      },
      renderMode: this.renderMode,
    };
  }

  /**
   * Get the texture images for debug display
   */
  getTextures(): OrbitalTextures {
    return this.textures;
  }
}

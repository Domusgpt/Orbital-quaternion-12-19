import { OrbitalShaderManager } from "./shaders/OrbitalShaderModules";
import { Quaternion, toAxisAngle } from "./quaternion";

export type OrbitalTextures = {
  ring0: HTMLImageElement;
  ring1: HTMLImageElement;
};

export class ProductOrbitVisualizer {
  private canvas: HTMLCanvasElement;
  private textures: OrbitalTextures;
  private gl: WebGLRenderingContext | WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private shaderManager: OrbitalShaderManager | null = null;
  private buffer: WebGLBuffer | null = null;
  private supported = false;
  private uniforms: {
    yaw: WebGLUniformLocation | null;
    pitch: WebGLUniformLocation | null;
    velocity: WebGLUniformLocation | null;
    warp: WebGLUniformLocation | null;
    textureRing0: WebGLUniformLocation | null;
    textureRing1: WebGLUniformLocation | null;
  } | null = null;

  private currentYaw = 0;
  private currentPitch = 0;
  private velocity = 0;

  constructor(canvas: HTMLCanvasElement, textures: OrbitalTextures) {
    this.canvas = canvas;
    this.textures = textures;
    this.initWebGL();
  }

  isSupported() {
    return this.supported;
  }

  private initWebGL() {
    this.gl =
      this.canvas.getContext("webgl2") || this.canvas.getContext("webgl");

    if (!this.gl) {
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
      textureRing1: this.gl.getUniformLocation(this.program, "u_textureRing1")
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

    this.currentPitch += xEnergy * 5.0;
    this.currentPitch = Math.max(0, Math.min(30, this.currentPitch));

    const velocityScale = dt > 0 ? 1 / dt : 1;
    const instantaneousVelocity = yEnergy * velocityScale;
    this.velocity = this.velocity * 0.85 + instantaneousVelocity * 0.15;
  }

  render() {
    if (!this.gl || !this.program || !this.buffer || !this.uniforms) {
      return;
    }

    this.gl.clearColor(1, 1, 1, 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);

    this.gl.useProgram(this.program);

    const warpFactor = Math.min(0.35, 0.08 + Math.abs(this.velocity) * 0.05);

    this.gl.uniform1f(this.uniforms.yaw, this.currentYaw);
    this.gl.uniform1f(this.uniforms.pitch, this.currentPitch);
    this.gl.uniform1f(this.uniforms.velocity, this.velocity);
    this.gl.uniform1f(this.uniforms.warp, warpFactor);

    this.gl.uniform1i(this.uniforms.textureRing0, 0);
    this.gl.uniform1i(this.uniforms.textureRing1, 1);

    const posLoc = this.gl.getAttribLocation(this.program, "a_position");
    this.gl.enableVertexAttribArray(posLoc);
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.buffer);
    this.gl.vertexAttribPointer(posLoc, 2, this.gl.FLOAT, false, 0, 0);

    this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
  }
}

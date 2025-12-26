import { fromYawPitch, Quaternion } from "../../core/quaternion";

export type OrbitalInputUpdate = {
  rotation: Quaternion;
  deltaTime: number;
  velocity: number;
  pitch: number;
  yaw: number;
};

export class OrbitalInputBridge {
  private element: HTMLElement;
  private onUpdate: (data: OrbitalInputUpdate) => void;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private lastTime = performance.now();
  private dragging = false;
  private yaw = 0;
  private pitch = 0;
  private velocity = 0;
  private frameId: number | null = null;

  private readonly yawSensitivity = 0.006;
  private readonly pitchSensitivity = 0.15;
  private readonly friction = 0.94;

  constructor(element: HTMLElement, onUpdate: (data: OrbitalInputUpdate) => void) {
    this.element = element;
    this.onUpdate = onUpdate;

    this.handlePointerDown = this.handlePointerDown.bind(this);
    this.handlePointerMove = this.handlePointerMove.bind(this);
    this.handlePointerUp = this.handlePointerUp.bind(this);
    this.animate = this.animate.bind(this);

    this.attach();
  }

  private attach() {
    this.element.addEventListener("pointerdown", this.handlePointerDown);
    window.addEventListener("pointermove", this.handlePointerMove);
    window.addEventListener("pointerup", this.handlePointerUp);
    window.addEventListener("pointercancel", this.handlePointerUp);
    this.frameId = requestAnimationFrame(this.animate);
  }

  detach() {
    this.element.removeEventListener("pointerdown", this.handlePointerDown);
    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerup", this.handlePointerUp);
    window.removeEventListener("pointercancel", this.handlePointerUp);
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
    }
  }

  private handlePointerDown(event: PointerEvent) {
    this.dragging = true;
    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.velocity = 0;
    this.lastTime = performance.now();
    this.element.setPointerCapture(event.pointerId);
  }

  private handlePointerMove(event: PointerEvent) {
    if (!this.dragging) {
      return;
    }

    const now = performance.now();
    const deltaX = event.clientX - this.lastPointerX;
    const deltaY = event.clientY - this.lastPointerY;
    const deltaTime = Math.max(16, now - this.lastTime);

    this.yaw += deltaX * this.yawSensitivity;
    this.pitch = Math.min(30, Math.max(0, this.pitch - deltaY * this.pitchSensitivity));

    this.velocity = (deltaX * this.yawSensitivity) / (deltaTime / 1000);

    this.lastPointerX = event.clientX;
    this.lastPointerY = event.clientY;
    this.lastTime = now;

    this.emitUpdate(deltaTime / 1000);
  }

  private handlePointerUp(event: PointerEvent) {
    if (!this.dragging) {
      return;
    }

    this.dragging = false;
    this.element.releasePointerCapture(event.pointerId);
    this.lastTime = performance.now();
  }

  private animate() {
    const now = performance.now();
    const deltaTime = Math.max(16, now - this.lastTime);

    if (!this.dragging && Math.abs(this.velocity) > 0.0001) {
      this.yaw += this.velocity * (deltaTime / 1000);
      this.velocity *= this.friction;
      this.emitUpdate(deltaTime / 1000);
    }

    this.lastTime = now;
    this.frameId = requestAnimationFrame(this.animate);
  }

  private emitUpdate(deltaTime: number) {
    const rotation = fromYawPitch(this.yaw, (this.pitch * Math.PI) / 180);
    this.onUpdate({
      rotation,
      deltaTime,
      velocity: this.velocity,
      pitch: this.pitch,
      yaw: this.yaw
    });
  }
}

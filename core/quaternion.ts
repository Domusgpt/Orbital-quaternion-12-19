export type Quaternion = {
  x: number;
  y: number;
  z: number;
  w: number;
};

export type AxisAngle = {
  axis: [number, number, number];
  angle: number;
};

export const toAxisAngle = (q: Quaternion): AxisAngle => {
  const clampedW = Math.min(1, Math.max(-1, q.w));
  const angle = 2 * Math.acos(clampedW);
  const sinHalf = Math.sqrt(1 - clampedW * clampedW);

  if (sinHalf < 0.0001) {
    return { axis: [0, 1, 0], angle: 0 };
  }

  return {
    axis: [q.x / sinHalf, q.y / sinHalf, q.z / sinHalf],
    angle
  };
};

export const fromYawPitch = (yaw: number, pitch: number): Quaternion => {
  const halfYaw = yaw * 0.5;
  const halfPitch = pitch * 0.5;

  const cy = Math.cos(halfYaw);
  const sy = Math.sin(halfYaw);
  const cx = Math.cos(halfPitch);
  const sx = Math.sin(halfPitch);

  return {
    w: cy * cx,
    x: sx * cy,
    y: sy * cx,
    z: -sy * sx
  };
};

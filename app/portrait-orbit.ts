export function portraitOrbitPose(time: number) {
  const spinSpeed = 0.42;
  return { spin: time * spinSpeed, spinSpeed };
}

export function portraitOrbitPoint(u: number, v: number, time: number) {
  const { spin } = portraitOrbitPose(time);
  const angle = u * Math.PI * 2 + spin;
  const tube = v * Math.PI * 2;
  const radius = 236 + 9 * Math.cos(tube);
  const x = radius * Math.cos(angle);
  const y = 365 + (112 + 5 * Math.cos(tube)) * Math.sin(angle) + 4 * Math.sin(tube);
  const z = radius * 0.58 * Math.sin(angle) + 9 * Math.sin(tube);
  const perspective = 1050 / (1050 - z);
  return {
    x: 300 + x * perspective,
    y: 365 + (y - 365) * perspective,
    z,
  };
}

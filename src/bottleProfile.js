import * as THREE from "three";

export const BP = [
  [0.02, 0],
  [0.22, 0.04],
  [0.38, 0.1],
  [0.44, 0.24],
  [0.44, 0.48],
  [0.42, 0.6],
  [0.2, 0.72],
  [0.15, 0.82],
  [0.17, 0.88],
  [0.17, 1.0],
];
export const BH = 3.2;
export const BR = 0.9;

export function createBottleLatheGeometry() {
  const bPts = BP.map(([r, t]) => new THREE.Vector2(r * BR, t * BH - BH / 2));
  return new THREE.LatheGeometry(bPts, 80);
}

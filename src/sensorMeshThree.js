import * as THREE from "three";

export function makeSensorGeometry(shape, sw, sh) {
  if (shape === "rect") return new THREE.PlaneGeometry(sw, sh);
  if (shape === "round") return new THREE.CircleGeometry(Math.min(sw, sh) / 2, 40);
  if (shape === "hex") {
    const s = new THREE.Shape();
    const r = Math.min(sw, sh) / 2;
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 3) * i - Math.PI / 6;
      if (i) s.lineTo(r * Math.cos(a), r * Math.sin(a));
      else s.moveTo(r * Math.cos(a), r * Math.sin(a));
    }
    s.closePath();
    return new THREE.ShapeGeometry(s);
  }
  if (shape === "cross") {
    const s = new THREE.Shape();
    const t = sw * 0.38;
    s.moveTo(-t, -sh / 2);
    s.lineTo(t, -sh / 2);
    s.lineTo(t, -t);
    s.lineTo(sw / 2, -t);
    s.lineTo(sw / 2, t);
    s.lineTo(t, t);
    s.lineTo(t, sh / 2);
    s.lineTo(-t, sh / 2);
    s.lineTo(-t, t);
    s.lineTo(-sw / 2, t);
    s.lineTo(-sw / 2, -t);
    s.lineTo(-t, -t);
    s.closePath();
    return new THREE.ShapeGeometry(s);
  }
  return new THREE.PlaneGeometry(sw, sh);
}

export function buildSensorMesh(sc) {
  const geo = makeSensorGeometry(sc.shape, sc.w, sc.h);
  const mat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(sc.color),
    roughness: 0.4,
    metalness: 0.3,
    transparent: true,
    opacity: sc.opacity,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(sc.color),
    emissiveIntensity: 0.12,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.add(
    new THREE.LineSegments(
      new THREE.EdgesGeometry(geo),
      new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.38 })
    )
  );
  const dg = new THREE.CircleGeometry(0.012, 8);
  const dm = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 });
  [
    [sc.w / 2 - 0.024, sc.h / 2 - 0.024],
    [-(sc.w / 2 - 0.024), sc.h / 2 - 0.024],
    [sc.w / 2 - 0.024, -(sc.h / 2 - 0.024)],
    [-(sc.w / 2 - 0.024), -(sc.h / 2 - 0.024)],
  ].forEach(([ox, oy]) => {
    const d = new THREE.Mesh(dg, dm);
    d.position.set(ox, oy, 0.001);
    mesh.add(d);
  });
  return mesh;
}

export function disposeSensorMesh(mesh) {
  if (!mesh) return;
  mesh.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
      else o.material.dispose();
    }
  });
}

export function patchRecordFromMesh(mesh, cfg) {
  return {
    shape: cfg.shape,
    w: cfg.w,
    h: cfg.h,
    color: cfg.color,
    opacity: cfg.opacity,
    px: mesh.position.x,
    py: mesh.position.y,
    pz: mesh.position.z,
    qx: mesh.quaternion.x,
    qy: mesh.quaternion.y,
    qz: mesh.quaternion.z,
    qw: mesh.quaternion.w,
  };
}

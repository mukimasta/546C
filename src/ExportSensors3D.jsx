import { useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import { buildSensorMesh, disposeSensorMesh } from "./sensorMeshThree.js";

function traceBetween(a, b, mat) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  if (len < 1e-4) return null;
  const geom = new THREE.CylinderGeometry(0.0065, 0.0065, len, 8);
  const mesh = new THREE.Mesh(geom, mat);
  const mid = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  mesh.position.copy(mid);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return mesh;
}

/**
 * Same layout as Preview (transforms from raycast placement); sensors + schematic routing — no bottle geometry.
 */
export default function ExportSensors3D({ patches }) {
  const rootRef = useRef(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const valid = (patches || []).filter((p) => p.px !== undefined);
    if (!valid.length) return;

    const sceneEl = root.querySelector("[data-export-scene]");
    const canvas = root.querySelector("canvas");

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x0a0e14, 1);

    const S = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 50);
    camera.position.set(0, 1.1, 5.2);
    camera.lookAt(0, -0.15, 0);

    function resize() {
      const w = sceneEl.clientWidth;
      const h = sceneEl.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    resize();
    window.addEventListener("resize", resize);

    const amb = new THREE.AmbientLight(0xd8e4f0, 0.55);
    S.add(amb);
    const key = new THREE.DirectionalLight(0xffffff, 0.75);
    key.position.set(3, 6, 4);
    S.add(key);
    const fill = new THREE.DirectionalLight(0xaaccff, 0.2);
    fill.position.set(-3, 2, 2);
    S.add(fill);

    const group = new THREE.Group();
    S.add(group);

    const traceMat = new THREE.MeshStandardMaterial({
      color: 0xc9a060,
      metalness: 0.7,
      roughness: 0.28,
      emissive: 0x3a2508,
      emissiveIntensity: 0.12,
    });
    const circuits = [];
    const positions = valid.map((p) => new THREE.Vector3(p.px, p.py, p.pz));
    for (let i = 0; i < positions.length - 1; i++) {
      const t = traceBetween(positions[i], positions[i + 1], traceMat);
      if (t) {
        group.add(t);
        circuits.push(t);
      }
    }

    const meshes = [];
    valid.forEach((p) => {
      const cfg = {
        shape: p.shape,
        w: p.w,
        h: p.h,
        color: p.color,
        opacity: p.opacity ?? 0.88,
      };
      const mesh = buildSensorMesh(cfg);
      mesh.position.set(p.px, p.py, p.pz);
      mesh.quaternion.set(p.qx, p.qy, p.qz, p.qw);
      group.add(mesh);
      meshes.push(mesh);
    });

    let drag = false;
    let pm = { x: 0, y: 0 };
    let autoRot = true;
    let aTimer;

    const onDown = (e) => {
      const cx = e.clientX ?? e.touches?.[0]?.clientX;
      const cy = e.clientY ?? e.touches?.[0]?.clientY;
      drag = true;
      pm = { x: cx, y: cy };
      autoRot = false;
      clearTimeout(aTimer);
    };
    const onUp = () => {
      drag = false;
      aTimer = setTimeout(() => {
        autoRot = true;
      }, 3500);
    };
    const onMove = (e) => {
      const cx = e.clientX ?? e.touches?.[0]?.clientX;
      const cy = e.clientY ?? e.touches?.[0]?.clientY;
      if (!drag || cx === undefined) return;
      group.rotation.y += (cx - pm.x) * 0.012;
      group.rotation.x = Math.max(-0.55, Math.min(0.55, group.rotation.x + (cy - pm.y) * 0.006));
      pm = { x: cx, y: cy };
    };

    canvas.style.cursor = "grab";
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("mousemove", onMove);
    canvas.addEventListener(
      "touchstart",
      (e) => {
        if (!e.touches?.[0]) return;
        onDown({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
      },
      { passive: true }
    );
    window.addEventListener("touchend", onUp);
    window.addEventListener(
      "touchmove",
      (e) => {
        if (!e.touches?.[0]) return;
        onMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
      },
      { passive: true }
    );

    let raf = 0;
    function animate() {
      raf = requestAnimationFrame(animate);
      if (autoRot) group.rotation.y += 0.004;
      renderer.render(S, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("touchend", onUp);
      clearTimeout(aTimer);
      window.removeEventListener("resize", resize);
      circuits.forEach((c) => c.geometry.dispose());
      traceMat.dispose();
      meshes.forEach((m) => disposeSensorMesh(m));
      renderer.dispose();
    };
  }, [patches]);

  const ok = patches?.some((p) => p.px !== undefined);

  if (!patches?.length) {
    return (
      <div
        style={{
          minHeight: 280,
          border: "1px dashed rgba(120,120,120,0.4)",
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--c-text-secondary)",
          fontSize: "0.85rem",
          fontFamily: "'DM Mono', monospace",
          padding: "1.5rem",
        }}
      >
        No sensors placed — return to Preview and add patches first.
      </div>
    );
  }

  if (!ok) {
    return (
      <div
        style={{
          minHeight: 200,
          padding: "1rem",
          color: "var(--c-text-secondary)",
          fontSize: "0.85rem",
          fontFamily: "'DM Mono', monospace",
        }}
      >
        Layout data missing — place sensors again in Preview, then open Export.
      </div>
    );
  }

  return (
    <div ref={rootRef} style={{ position: "relative", width: "100%", minHeight: 420, height: "min(55vh, 520px)" }}>
      <div data-export-scene style={{ position: "absolute", inset: 0, borderRadius: 12, overflow: "hidden" }}>
        <canvas style={{ display: "block", width: "100%", height: "100%" }} />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 10,
          left: "50%",
          transform: "translateX(-50%)",
          fontSize: 10,
          letterSpacing: 1,
          color: "rgba(160,185,210,0.75)",
          fontFamily: "'DM Mono', monospace",
          pointerEvents: "none",
        }}
      >
        drag to rotate · sensors + routing (no bottle mesh)
      </div>
    </div>
  );
}

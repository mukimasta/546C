import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import * as THREE from "three";
import { buildSensorMesh, disposeSensorMesh, patchRecordFromMesh } from "./sensorMeshThree.js";
import { createBottleLatheGeometry } from "./bottleProfile.js";

// Public file; must respect Vite base (e.g. GitHub Pages at /<repo>/)
const BG_URL = `${import.meta.env.BASE_URL}Untitled.jpg`;

/** Fixed mesh look — comes from scan, not user-edited */
const MESH_COLOR = 0xb9c0bc;
const MESH_ROUGHNESS = 0.5;
const MESH_METALNESS = 0.06;

/** @param {THREE.Mesh} bMesh bottle mesh (for face normal) @param {THREE.Group} group parent */
function attachSensorToHit(mesh, hit, bMesh, group) {
  const normalWorld = hit.face.normal.clone().transformDirection(bMesh.matrixWorld).normalize();
  const offset = hit.point.clone().add(normalWorld.clone().multiplyScalar(0.004));
  mesh.position.copy(group.worldToLocal(offset));
  const qDesired = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normalWorld);
  const qParent = new THREE.Quaternion();
  group.getWorldQuaternion(qParent);
  mesh.quaternion.copy(qParent.clone().invert().multiply(qDesired));
}

export default function ARPreview({ onSensorCountChange, onPatchesChange }) {
  const rootRef = useRef(null);
  const [, bump] = useReducer((n) => n + 1, 0);

  const [sCol, setSCol] = useState("#e84040");
  const [sW, setSW] = useState(0.15);
  const [sH, setSH] = useState(0.2);
  const [sOp, setSOp] = useState(0.88);
  const [sShape, setSShape] = useState("rect");

  const threeRef = useRef(null);
  /** @type {React.MutableRefObject<{ mesh: THREE.Mesh }[]>} */
  const placedRef = useRef([]);
  /** Parallel to placedRef — snapshot for flat export preview */
  const patchesMetaRef = useRef([]);
  const sensorRef = useRef({ color: sCol, w: sW, h: sH, opacity: sOp, shape: sShape });

  useEffect(() => {
    sensorRef.current = { color: sCol, w: sW, h: sH, opacity: sOp, shape: sShape };
  }, [sCol, sW, sH, sOp, sShape]);

  const notifyCount = useCallback(
    (n) => {
      onSensorCountChange?.(n);
    },
    [onSensorCountChange]
  );

  const syncPatchesToParent = useCallback(() => {
    const list = patchesMetaRef.current.map((p) => ({ ...p }));
    onPatchesChange?.(list);
  }, [onPatchesChange]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const sceneEl = root.querySelector("[data-scene]");
    const canvas = root.querySelector("canvas");

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setClearColor(0x000000, 0);

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

    const amb = new THREE.AmbientLight(0xfff0e8, 0.58);
    S.add(amb);
    const key = new THREE.DirectionalLight(0xfff8f0, 0.88);
    key.position.set(3, 6, 4);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -4;
    key.shadow.camera.right = 4;
    key.shadow.camera.top = 6;
    key.shadow.camera.bottom = -2;
    key.shadow.bias = -0.001;
    S.add(key);
    const fill = new THREE.DirectionalLight(0xc0d8ff, 0.25);
    fill.position.set(-3, 2, 3);
    S.add(fill);
    const bot = new THREE.DirectionalLight(0xffeedd, 0.12);
    bot.position.set(0, -3, 2);
    S.add(bot);

    const bottleGeo = createBottleLatheGeometry();
    const bottleMat = new THREE.MeshStandardMaterial({
      color: MESH_COLOR,
      roughness: MESH_ROUGHNESS,
      metalness: MESH_METALNESS,
      transparent: false,
      opacity: 1,
    });
    const group = new THREE.Group();
    S.add(group);
    const bMesh = new THREE.Mesh(bottleGeo, bottleMat);
    bMesh.castShadow = true;
    bMesh.receiveShadow = true;
    group.add(bMesh);

    const shadowGround = new THREE.Mesh(
      new THREE.PlaneGeometry(14, 14),
      new THREE.ShadowMaterial({ opacity: 0.28, transparent: true })
    );
    shadowGround.rotation.x = -Math.PI / 2;
    shadowGround.position.y = -1.62;
    shadowGround.receiveShadow = true;
    S.add(shadowGround);

    placedRef.current = [];
    patchesMetaRef.current = [];

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    function clientToNDC(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    }

    function placeAtEvent(clientX, clientY) {
      clientToNDC(clientX, clientY);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObject(bMesh, false);
      if (!hits.length) return;
      const hit = hits[0];
      const cfg = sensorRef.current;
      const mesh = buildSensorMesh(cfg);
      attachSensorToHit(mesh, hit, bMesh, group);
      group.add(mesh);
      placedRef.current.push({ mesh });
      patchesMetaRef.current.push(patchRecordFromMesh(mesh, { ...sensorRef.current }));
      bump();
      notifyCount(placedRef.current.length);
      syncPatchesToParent();
    }

    function rebuildAllPlaced() {
      const cfg = sensorRef.current;
      const saved = placedRef.current.map(({ mesh }) => ({
        pos: mesh.position.clone(),
        quat: mesh.quaternion.clone(),
      }));
      placedRef.current.forEach(({ mesh }) => {
        group.remove(mesh);
        disposeSensorMesh(mesh);
      });
      placedRef.current = [];
      patchesMetaRef.current = [];
      saved.forEach(({ pos, quat }) => {
        const mesh = buildSensorMesh(cfg);
        mesh.position.copy(pos);
        mesh.quaternion.copy(quat);
        group.add(mesh);
        placedRef.current.push({ mesh });
        patchesMetaRef.current.push(patchRecordFromMesh(mesh, cfg));
      });
      bump();
      syncPatchesToParent();
    }

    function clearAll() {
      placedRef.current.forEach(({ mesh }) => {
        group.remove(mesh);
        disposeSensorMesh(mesh);
      });
      placedRef.current = [];
      patchesMetaRef.current = [];
      bump();
      notifyCount(0);
      syncPatchesToParent();
    }

    let drag = false;
    let couldBeClick = false;
    let startX = 0;
    let startY = 0;
    let pm = { x: 0, y: 0 };
    let autoRot = true;
    let aTimer;
    const CLICK_MAX_PX = 8;

    const onDown = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      const cx = e.clientX ?? e.touches?.[0]?.clientX;
      const cy = e.clientY ?? e.touches?.[0]?.clientY;
      drag = true;
      couldBeClick = true;
      startX = cx;
      startY = cy;
      pm = { x: cx, y: cy };
      autoRot = false;
      clearTimeout(aTimer);
    };

    const onUp = (e) => {
      const cx = e.clientX ?? e.changedTouches?.[0]?.clientX;
      const cy = e.clientY ?? e.changedTouches?.[0]?.clientY;
      if (couldBeClick && drag && cx !== undefined) {
        const d = Math.hypot(cx - startX, cy - startY);
        if (d < CLICK_MAX_PX) {
          placeAtEvent(cx, cy);
        }
      }
      drag = false;
      couldBeClick = false;
      aTimer = setTimeout(() => {
        autoRot = true;
      }, 3000);
    };

    const onMove = (e) => {
      const cx = e.clientX ?? e.touches?.[0]?.clientX;
      const cy = e.clientY ?? e.touches?.[0]?.clientY;
      if (!drag || cx === undefined) return;
      if (Math.hypot(cx - startX, cy - startY) >= CLICK_MAX_PX) couldBeClick = false;
      group.rotation.y += (cx - pm.x) * 0.012;
      group.rotation.x = Math.max(-0.5, Math.min(0.5, group.rotation.x + (cy - pm.y) * 0.006));
      pm = { x: cx, y: cy };
    };

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
    window.addEventListener("touchend", (e) => {
      if (!e.changedTouches?.[0]) return;
      onUp({ clientX: e.changedTouches[0].clientX, clientY: e.changedTouches[0].clientY });
    });
    window.addEventListener(
      "touchmove",
      (e) => {
        if (!e.touches?.[0]) return;
        onMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
      },
      { passive: true }
    );

    threeRef.current = {
      renderer,
      scene: S,
      camera,
      group,
      bMesh,
      rebuildAllPlaced,
      clearAll,
    };

    bump();

    let raf = 0;
    function animate() {
      raf = requestAnimationFrame(animate);
      if (autoRot) group.rotation.y += 0.005;
      renderer.render(S, camera);
    }
    animate();

    return () => {
      cancelAnimationFrame(raf);
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("mousemove", onMove);
      clearTimeout(aTimer);
      window.removeEventListener("resize", resize);
      placedRef.current.forEach(({ mesh }) => {
        group.remove(mesh);
        disposeSensorMesh(mesh);
      });
      placedRef.current = [];
      patchesMetaRef.current = [];
      bottleGeo.dispose();
      bottleMat.dispose();
      shadowGround.geometry.dispose();
      shadowGround.material.dispose();
      renderer.dispose();
      threeRef.current = null;
    };
  }, []);

  useEffect(() => {
    threeRef.current?.rebuildAllPlaced?.();
  }, [sCol, sW, sH, sOp, sShape]);

  const displayCount = placedRef.current.length;

  const card = {
    background: "rgba(255,255,255,0.05)",
    border: "0.5px solid rgba(255,255,255,0.09)",
    borderRadius: 9,
    padding: "11px 12px",
  };
  const cl = {
    fontSize: 9,
    letterSpacing: 2,
    color: "rgba(120,160,200,0.75)",
    marginBottom: 8,
    fontFamily: "'DM Mono', monospace",
  };
  const row = { display: "flex", alignItems: "center", gap: 8, marginBottom: 5 };
  const rl = { fontSize: 10, color: "rgba(160,185,210,0.78)", minWidth: 60 };
  const rv = { fontSize: 10, color: "rgba(215,228,245,0.92)", minWidth: 30, textAlign: "right" };

  return (
    <div
      ref={rootRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 0,
        fontFamily: "'DM Mono', monospace",
      }}
    >
      <div
        data-scene
        style={{
          position: "absolute",
          inset: 0,
          cursor: "crosshair",
          background: `url(${BG_URL}) center center / cover no-repeat`,
        }}
      >
        <canvas style={{ position: "absolute", inset: 0, width: "100%", height: "100%", display: "block" }} />
      </div>

      <div
        style={{
          position: "absolute",
          top: 14,
          left: 14,
          zIndex: 10,
          background: "rgba(0,0,0,0.48)",
          backdropFilter: "blur(16px)",
          border: "0.5px solid rgba(255,255,255,0.13)",
          borderRadius: 9,
          padding: "8px 16px",
          fontSize: 10,
          letterSpacing: 2,
          color: "#3ecf84",
          maxWidth: 280,
        }}
      >
        {displayCount} SENSOR{displayCount !== 1 ? "S" : ""} — click mesh · drag to rotate
      </div>

      <div
        style={{
          position: "absolute",
          right: 10,
          top: 10,
          bottom: 10,
          width: 240,
          zIndex: 10,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(20px)",
          border: "0.5px solid rgba(255,255,255,0.10)",
          borderRadius: 12,
          overflowY: "auto",
          padding: 12,
          display: "flex",
          flexDirection: "column",
          gap: 9,
        }}
      >
        <div style={card}>
          <button
            type="button"
            onClick={() => threeRef.current?.clearAll?.()}
            style={{
              width: "100%",
              padding: "5px 10px",
              fontSize: 9,
              letterSpacing: 1.5,
              border: "0.5px solid rgba(255,255,255,0.14)",
              borderRadius: 6,
              cursor: "pointer",
              background: "transparent",
              color: "rgba(155,180,210,0.78)",
            }}
          >
            CLEAR ALL SENSORS
          </button>
        </div>

        <div style={card}>
          <div style={cl}>SENSOR PROPERTIES</div>
          <p style={{ fontSize: 8, color: "rgba(120,160,200,0.55)", marginBottom: 8, lineHeight: 1.4 }}>
            Applies to new sensors and updates existing patches.
          </p>
          <div style={row}>
            <span style={rl}>Color</span>
            <input type="color" value={sCol} onChange={(e) => setSCol(e.target.value)} style={{ flex: 1, height: 26, border: "0.5px solid rgba(255,255,255,0.15)", borderRadius: 4, cursor: "pointer", background: "transparent" }} />
          </div>
          <div style={row}>
            <span style={rl}>Width</span>
            <input type="range" min={0.06} max={0.3} step={0.01} value={sW} onChange={(e) => setSW(parseFloat(e.target.value))} style={{ flex: 1 }} />
            <span style={rv}>{Math.round(sW * 125)}mm</span>
          </div>
          <div style={row}>
            <span style={rl}>Height</span>
            <input type="range" min={0.08} max={0.38} step={0.01} value={sH} onChange={(e) => setSH(parseFloat(e.target.value))} style={{ flex: 1 }} />
            <span style={rv}>{Math.round(sH * 125)}mm</span>
          </div>
          <div style={row}>
            <span style={rl}>Opacity</span>
            <input type="range" min={0.2} max={1} step={0.01} value={sOp} onChange={(e) => setSOp(parseFloat(e.target.value))} style={{ flex: 1 }} />
            <span style={rv}>{Math.round(sOp * 100)}%</span>
          </div>
          <div style={{ ...cl, marginTop: 6 }}>SHAPE</div>
          <div style={{ display: "flex", gap: 4 }}>
            {["rect", "round", "hex", "cross"].map((sh) => (
              <button
                type="button"
                key={sh}
                onClick={() => setSShape(sh)}
                style={{
                  flex: 1,
                  padding: "4px 2px",
                  textAlign: "center",
                  fontSize: 9,
                  letterSpacing: 1,
                  border: `0.5px solid ${sShape === sh ? "#4a9fd4" : "rgba(255,255,255,0.14)"}`,
                  borderRadius: 5,
                  cursor: "pointer",
                  background: sShape === sh ? "rgba(74,159,212,0.18)" : "transparent",
                  color: sShape === sh ? "#90c8f0" : "rgba(155,180,210,0.78)",
                }}
              >
                {sh === "rect" ? "Rect" : sh === "round" ? "Round" : sh === "hex" ? "Hex" : "Cross"}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

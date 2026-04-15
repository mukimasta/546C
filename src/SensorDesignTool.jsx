import { useState, useEffect } from "react";
import ARPreview from "./ARPreview.jsx";
import ExportSensors3D from "./ExportSensors3D.jsx";

const STEPS = ["Scan", "Preview", "Export"];

function ScanView({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState("waiting");

  useEffect(() => {
    if (phase === "scanning") {
      const iv = setInterval(() => {
        setProgress((p) => {
          if (p >= 100) {
            clearInterval(iv);
            setPhase("processing");
            return 100;
          }
          return p + 2;
        });
      }, 80);
      return () => clearInterval(iv);
    }
    if (phase === "processing") {
      const t = setTimeout(() => setPhase("done"), 1500);
      return () => clearTimeout(t);
    }
  }, [phase]);

  return (
    <div style={{ textAlign: "center", padding: "2rem 0" }}>
      {phase === "waiting" && (
        <>
          <div style={{ fontSize: "4rem", marginBottom: "1.5rem", opacity: 0.3 }}>📱</div>
          <p style={{ color: "var(--c-text-secondary)", marginBottom: "1.5rem", fontSize: "0.9rem", lineHeight: 1.6 }}>
            Take a 360° video around your object.
            <br />
            Keep steady, move slowly.
          </p>
          <button type="button" onClick={() => setPhase("scanning")} style={btnStyle}>
            Start Capture
          </button>
        </>
      )}
      {phase === "scanning" && (
        <>
          <div style={{ position: "relative", width: 200, height: 200, margin: "0 auto 1.5rem" }}>
            <svg viewBox="0 0 200 200" style={{ width: "100%", transform: `rotate(${progress * 3.6}deg)`, transition: "transform 0.1s" }}>
              <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(0,180,255,0.15)" strokeWidth="3" />
              <circle
                cx="100"
                cy="100"
                r="80"
                fill="none"
                stroke="#00b4ff"
                strokeWidth="3"
                strokeDasharray={`${progress * 5.02} 502`}
                strokeLinecap="round"
                transform="rotate(-90 100 100)"
              />
            </svg>
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%,-50%)",
                fontFamily: "'DM Mono', monospace",
                fontSize: "1.8rem",
                color: "#00b4ff",
              }}
            >
              {progress}°
            </div>
          </div>
          <p style={{ color: "var(--c-text-secondary)", fontSize: "0.85rem" }}>Capturing point cloud…</p>
        </>
      )}
      {phase === "processing" && (
        <div style={{ padding: "3rem 0" }}>
          <div
            style={{
              width: 40,
              height: 40,
              border: "3px solid rgba(0,180,255,0.2)",
              borderTopColor: "#00b4ff",
              borderRadius: "50%",
              margin: "0 auto 1.5rem",
              animation: "spin 0.8s linear infinite",
            }}
          />
          <p style={{ color: "var(--c-text-secondary)", fontSize: "0.85rem" }}>Reconstructing mesh…</p>
        </div>
      )}
      {phase === "done" && (
        <>
          <p style={{ color: "#00b4ff", fontSize: "0.9rem", marginBottom: "0.75rem", fontFamily: "'DM Mono', monospace" }}>
            ✓ Mesh ready · 12,847 vertices · 25,412 faces
          </p>
          <p style={{ color: "var(--c-text-secondary)", fontSize: "0.8rem", marginBottom: "1.5rem" }}>Next: place sensors on the object in 3D.</p>
          <button type="button" onClick={onComplete} style={btnStyle}>
            Open preview
          </button>
        </>
      )}
    </div>
  );
}

const btnStyle = {
  padding: "0.65rem 1.8rem",
  background: "#00b4ff",
  color: "#fff",
  border: "none",
  borderRadius: 8,
  cursor: "pointer",
  fontFamily: "'DM Mono', monospace",
  fontSize: "0.85rem",
  fontWeight: 600,
  letterSpacing: "0.02em",
};

const btnOutlineStyle = {
  ...btnStyle,
  background: "transparent",
  border: "1px solid rgba(0,180,255,0.4)",
  color: "#00b4ff",
};

export default function SensorDesignTool() {
  const [step, setStep] = useState(0);
  const [sensorCount, setSensorCount] = useState(0);
  /** Snapshot for flat “transparent sheet” preview on Export (no file download). */
  const [sheetPatches, setSheetPatches] = useState([]);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const handleExport = () => {
    setExporting(true);
    setTimeout(() => {
      setExporting(false);
      setExported(true);
    }, 2000);
  };

  const previewSpecs = (
    <div
      style={{
        padding: "1rem",
        borderRadius: 10,
        background: "rgba(255,255,255,0.02)",
        border: "1px solid var(--c-border)",
        fontFamily: "'DM Mono', monospace",
        fontSize: "0.75rem",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "0.6rem",
      }}
    >
      {[
        ["Placement", "Click on object"],
        ["Sensors placed", sensorCount],
        ["Mesh", "Bottle (prototype)"],
        ["Line width", "0.8 mm (nominal)"],
      ].map(([k, v]) => (
        <div key={k}>
          <div style={{ color: "var(--c-text-secondary)", fontSize: "0.65rem", marginBottom: 2 }}>{k}</div>
          <div style={{ color: "#e0e0e0" }}>{v}</div>
        </div>
      ))}
    </div>
  );

  return (
    <div
      style={{
        height: "100%",
        minHeight: "100vh",
        background: "#0a0e14",
        color: "#e0e0e0",
        fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif",
        "--c-text-secondary": "rgba(200,200,200,0.5)",
        "--c-border": "rgba(120,120,120,0.15)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@400;500;600;700&display=swap');
        @keyframes spin { to { transform: rotate(360deg) } }
        * { box-sizing: border-box; margin: 0; padding: 0; }
      `}</style>

      <header
        style={{
          padding: "1rem 1.5rem",
          borderBottom: "1px solid var(--c-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "linear-gradient(135deg, #00b4ff, #0066ff)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.75rem",
              fontWeight: 700,
              color: "#fff",
            }}
          >
            RS
          </div>
          <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.85rem", fontWeight: 500, letterSpacing: "0.05em", color: "rgba(255,255,255,0.7)" }}>
            SENSR
          </span>
        </div>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.7rem", color: "var(--c-text-secondary)" }}>v0.1 prototype</span>
      </header>

      <nav style={{ padding: "1rem 1.5rem", display: "flex", gap: "0.25rem", alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
            <button
              type="button"
              onClick={() => i <= step && setStep(i)}
              style={{
                padding: "0.3rem 0.7rem",
                borderRadius: 20,
                border: "none",
                cursor: i <= step ? "pointer" : "default",
                fontFamily: "'DM Mono', monospace",
                fontSize: "0.7rem",
                fontWeight: 500,
                background: i === step ? "rgba(0,180,255,0.15)" : "transparent",
                color: i === step ? "#00b4ff" : i < step ? "rgba(0,180,255,0.5)" : "var(--c-text-secondary)",
                letterSpacing: "0.03em",
                transition: "all 0.2s",
              }}
            >
              {i < step ? "✓ " : ""}
              {s}
            </button>
            {i < STEPS.length - 1 && <span style={{ color: "var(--c-border)", fontSize: "0.6rem" }}>—</span>}
          </div>
        ))}
      </nav>

      {step === 1 ? (
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
            <ARPreview onSensorCountChange={setSensorCount} onPatchesChange={setSheetPatches} />
          </div>
          <div style={{ padding: "0.65rem 1rem", borderTop: "1px solid var(--c-border)", flexShrink: 0, background: "#0a0e14" }}>
            {previewSpecs}
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button type="button" onClick={() => setStep(0)} style={btnOutlineStyle}>
                Back
              </button>
              <button type="button" onClick={() => setStep(2)} style={{ ...btnStyle, flex: 1 }}>
                Export
              </button>
            </div>
          </div>
        </div>
      ) : (
        <main style={{ padding: "0.5rem 1.5rem 2rem", maxWidth: step === 2 ? 680 : 480, margin: "0 auto", width: "100%", flex: 1 }}>
          {step === 0 && <ScanView onComplete={() => setStep(1)} />}

          {step === 2 && (
            <div style={{ padding: "1rem 0 2rem", maxWidth: 640, margin: "0 auto", width: "100%" }}>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 600, marginBottom: "0.75rem", textAlign: "center" }}>Export</h2>
              <p style={{ color: "var(--c-text-secondary)", fontSize: "0.8rem", textAlign: "center", marginBottom: "1.25rem" }}>
                Same 3D layout as Preview — sensors only, scanned object hidden. Rotate to inspect. UI preview, not a file download.
              </p>

              <ExportSensors3D patches={sheetPatches} />

              {!exported ? (
                <>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "row",
                      flexWrap: "nowrap",
                      alignItems: "stretch",
                      gap: "0.65rem",
                      marginTop: "1.5rem",
                      marginBottom: "1rem",
                      width: "100%",
                      maxWidth: "100%",
                      overflowX: "auto",
                      paddingBottom: 2,
                      WebkitOverflowScrolling: "touch",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--c-text-secondary)",
                        fontFamily: "'DM Mono', monospace",
                        whiteSpace: "nowrap",
                        alignSelf: "center",
                        flex: "0 0 auto",
                      }}
                    >
                      Demo: pick a target format
                    </span>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "row",
                        gap: "0.45rem",
                        flex: "1 1 auto",
                        minWidth: 0,
                      }}
                    >
                      {[
                        { fmt: "SVG", desc: "Laser cutting / vinyl cutting" },
                        { fmt: "DXF", desc: "CAD & CNC machining" },
                        { fmt: "PDF", desc: "Screen printing template" },
                      ].map((e) => (
                        <button
                          key={e.fmt}
                          type="button"
                          onClick={handleExport}
                          disabled={exporting}
                          title={e.desc}
                          style={{
                            flex: "1 1 0",
                            minWidth: "5.75rem",
                            maxWidth: "11rem",
                            padding: "0.55rem 0.5rem",
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid var(--c-border)",
                            borderRadius: 10,
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 4,
                            transition: "all 0.2s",
                            color: "#e0e0e0",
                            textAlign: "center",
                          }}
                        >
                          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.8rem", fontWeight: 600 }}>.{e.fmt.toLowerCase()}</div>
                          <div
                            style={{
                              fontSize: "0.62rem",
                              color: "var(--c-text-secondary)",
                              lineHeight: 1.3,
                              width: "100%",
                            }}
                          >
                            {e.desc}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                  {exporting && (
                    <p style={{ color: "#00b4ff", fontFamily: "'DM Mono', monospace", fontSize: "0.8rem", textAlign: "center" }}>
                      Preparing export pipeline…
                    </p>
                  )}
                </>
              ) : (
                <p style={{ textAlign: "center", color: "var(--c-text-secondary)", fontSize: "0.8rem", marginTop: "1rem", fontFamily: "'DM Mono', monospace" }}>
                  ✓ In a full build, this layout would encode to the selected format. Above stays the source preview.
                </p>
              )}

              <button
                type="button"
                onClick={() => {
                  setSensorCount(0);
                  setSheetPatches([]);
                  setStep(1);
                  setExported(false);
                  setExporting(false);
                }}
                style={{ ...btnOutlineStyle, marginTop: "1.25rem", display: "block", marginLeft: "auto", marginRight: "auto" }}
              >
                Back to Preview
              </button>
            </div>
          )}
        </main>
      )}
    </div>
  );
}

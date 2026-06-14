export default function ComplexityViewer({ data }) {
  const { complexityA, complexityB } = data;

  const ranking = {
    "O(1)": 1,
    "O(log n)": 2,
    "O(√n)": 3,
    "O(n)": 4,
    "O(V + E)": 4,
    "O(n log n)": 5,
    "O(α(n))": 5,
    "O(n²)": 6,
    "O(n³)": 7,
    "O(2^n)": 8,
  };

  const rankA = ranking[complexityA.complexity] || 999;
  const rankB = ranking[complexityB.complexity] || 999;

  let verdict = "";
  let verdictColor = "";

  if (rankA < rankB) {
    verdict = "🏆 File A is asymptotically faster";
    verdictColor = "#22c55e";
  } else if (rankB < rankA) {
    verdict = "🏆 File B is asymptotically faster";
    verdictColor = "#22c55e";
  } else {
    verdict = "⚖️ Both have the same asymptotic complexity";
    verdictColor = "#f59e0b";
  }

  const getColor = (complexity) => {
    if (
      complexity.includes("O(1)") ||
      complexity.includes("log")
    )
      return "#22c55e";

    if (
      complexity.includes("O(n)") ||
      complexity.includes("V + E")
    )
      return "#3b82f6";

    if (
      complexity.includes("n log n") ||
      complexity.includes("α(n)")
    )
      return "#f59e0b";

    return "#ef4444";
  };

  return (
    <div className="glass-panel viz-panel">
      <h2 style={{ marginBottom: "1rem" }}>
        ⚡ Time Complexity Comparison
      </h2>

        <div
  className="glass-panel"
  style={{
    padding: "1rem",
    marginBottom: "1.5rem",
    border: "1px solid rgba(255,255,255,0.08)",
  }}
>
  <h3 style={{ color: verdictColor }}>
    {verdict}
  </h3>

  <p style={{ marginTop: "0.5rem" }}>
    {complexityA.complexity} vs {complexityB.complexity}
  </p>
</div>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1.5rem",
          marginTop: "1rem",
        }}
      >
        {/* File A */}
        <div
          className="glass-panel"
          style={{
            padding: "1.25rem",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <h3>📄 File A</h3>

          <div
            style={{
              display: "inline-block",
              marginTop: "0.75rem",
              marginBottom: "0.75rem",
              padding: "0.6rem 1rem",
              borderRadius: "999px",
              background: getColor(complexityA.complexity),
              color: "white",
              fontWeight: "700",
              fontSize: "1.2rem",
            }}
          >
            {complexityA.complexity}
          </div>

          <p>
            <strong>Confidence:</strong>{" "}
            {complexityA.confidence}%
          </p>

          <ul style={{ marginTop: "0.75rem" }}>
            {complexityA.reason.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>

        {/* File B */}
        <div
          className="glass-panel"
          style={{
            padding: "1.25rem",
            border: "1px solid rgba(255,255,255,0.08)",
          }}
        >
          <h3>📄 File B</h3>

          <div
            style={{
              display: "inline-block",
              marginTop: "0.75rem",
              marginBottom: "0.75rem",
              padding: "0.6rem 1rem",
              borderRadius: "999px",
              background: getColor(complexityB.complexity),
              color: "white",
              fontWeight: "700",
              fontSize: "1.2rem",
            }}
          >
            {complexityB.complexity}
          </div>

          <p>
            <strong>Confidence:</strong>{" "}
            {complexityB.confidence}%
          </p>

          <ul style={{ marginTop: "0.75rem" }}>
            {complexityB.reason.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
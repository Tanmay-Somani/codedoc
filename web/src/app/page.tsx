export default function HomePage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "4rem auto",
        padding: "0 1.5rem",
        fontFamily: "system-ui, sans-serif",
        lineHeight: 1.6,
      }}
    >
      <h1 style={{ marginBottom: "0.5rem" }}>AI Codebase Doctor</h1>
      <p>
        Self-hostable code-analysis dashboard. Analysis agents review security,
        dependencies, and architecture - then produce actionable findings.
      </p>
      <ul>
        <li>
          Scan a repository by URL or use the built-in sample to see a live
          report.
        </li>
        <li>
          No code leaves your infrastructure beyond the safe,{" "}
          <strong>secret-redacted</strong> LLM prompt.
        </li>
        <li>
          Bring your own LLM key (OpenRouter by default, others supported).
        </li>
      </ul>
      <p style={{ color: "#555" }}>
        Backend API: <code>/api/health</code> · dashboard UI lands in the next
        milestone.
      </p>
    </main>
  );
}
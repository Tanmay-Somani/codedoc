import type { Finding } from "@/lib/types";

export const sampleFindings: Finding[] = [
  {
    id: 1,
    tool: "bandit",
    rule_id: "B608",
    severity: "high",
    file_path: "app/auth.py",
    line_start: 14,
    line_end: 14,
    message: "Potential hardcoded password: hardcoded_password_string",
    ai_explanation:
      "This code embeds a plaintext password directly in source. Anyone with read access to the repository can extract it. Replace with a secret-vault reference or environment variable.",
    root_cause: "Developer convenience made the secret a literal in a constants module.",
  },
  {
    id: 2,
    tool: "semgrep",
    rule_id: "python.lang.security.sql-injection",
    severity: "critical",
    file_path: "app/db.py",
    line_start: 42,
    line_end: 45,
    message: "SQL statement built from unsanitized user input",
    ai_explanation:
      "User-supplied input is interpolated directly into a SQL string. An attacker can inject arbitrary SQL. Use parameterized queries or an ORM to bind values safely.",
    root_cause: "Query built via f-string instead of a parameterized cursor.execute.",
  },
  {
    id: 3,
    tool: "gitleaks",
    rule_id: "generic-api-key",
    severity: "medium",
    file_path: ".env.example",
    line_start: 3,
    line_end: 3,
    message: "Detected a possible API key in source",
    ai_explanation:
      "A token-shaped string was found. It has been redacted before reaching any external LLM. Rotate the key and store it in the encrypted vault.",
    root_cause: "Example environment file committed with a placeholder that looks like a key.",
  },
  {
    id: 4,
    tool: "ruff",
    rule_id: "S105",
    severity: "low",
    file_path: "worker.py",
    line_start: 20,
    line_end: 20,
    message: "Hardcoded temporary admin password",
    ai_explanation:
      "A default password is set in code. While usable for local dev, it must not ship to production.",
    root_cause: "Bootstrap script uses a static default credential.",
  },
  {
    id: 5,
    tool: "eslint",
    rule_id: "no-unused-vars",
    severity: "info",
    file_path: "src/index.ts",
    line_start: 7,
    line_end: 7,
    message: "'foo' is defined but never used",
    ai_explanation:
      "Dead code increases maintenance cost. Removing unused bindings keeps the codebase clean.",
    root_cause: "Leftover variable from an earlier refactor.",
  },
];

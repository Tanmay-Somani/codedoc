import type { Finding, Severity } from "@/lib/types";

const severityColor: Record<Severity, [number, number, number]> = {
  critical: [239, 68, 68],
  high: [249, 115, 22],
  medium: [245, 158, 11],
  low: [14, 165, 233],
  info: [148, 163, 184],
};

function csvCell(value: string | number): string {
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportCSV(findings: Finding[], repoName: string): Promise<void> {
  const header = [
    "Severity",
    "Tool",
    "Rule",
    "File",
    "Line",
    "Message",
    "CVE",
    "CVSS",
    "Explanation",
  ].join(",");
  const rows = findings.map((f) =>
    [
      f.severity,
      f.tool,
      f.rule_id ?? "",
      f.file_path ?? "",
      f.line_start ?? "",
      f.message,
      f.vulnerability?.identifier ?? "",
      f.vulnerability?.cvss_score?.toString() ?? "",
      f.ai_explanation ?? "",
    ]
      .map(csvCell)
      .join(",")
  );
  download(`${repoName}-findings.csv`, [header, ...rows].join("\n"), "text/csv;charset=utf-8");
  return Promise.resolve();
}

export function exportJSON(findings: Finding[], repoName: string): Promise<void> {
  download(
    `${repoName}-findings.json`,
    JSON.stringify(findings, null, 2),
    "application/json;charset=utf-8"
  );
  return Promise.resolve();
}

export function exportPDF(findings: Finding[], repoName: string): Promise<void> {
  return import("jspdf")
    .then(async ({ jsPDF }) => {
      const { autoTable } = await import("jspdf-autotable");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const now = new Date().toISOString();

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(`CodeDoc findings report — ${repoName}`, 40, 40);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(120);
      doc.text(`Generated ${now} · ${findings.length} findings`, 40, 56);

      autoTable(doc, {
        head: [["Severity", "Tool", "Rule", "File:Line", "Message"]],
        body: findings.map((f) => [
          f.severity,
          f.tool,
          f.rule_id ?? "",
          `${f.file_path ?? ""}${f.line_start != null ? `:${f.line_start}` : ""}`,
          f.message,
        ]),
        startY: 72,
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [13, 148, 136], textColor: 255, fontStyle: "bold" },
        didParseCell: (data) => {
          if (data.section === "body" && data.column.index === 0) {
            const sev = data.cell.raw as string;
            const color = severityColor[sev as Severity];
            data.cell.styles.textColor = color;
            data.cell.styles.fontStyle = "bold";
          }
        },
        didDrawPage: (data) => {
          doc.setFontSize(8);
          doc.setTextColor(120);
          doc.text(
            `Page ${data.pageNumber}`,
            data.settings.margin.left,
            doc.internal.pageSize.getHeight() - 20
          );
        },
      });

      doc.save(`${repoName}-findings.pdf`);
    })
    .catch(() => {
      throw new Error("Failed to generate PDF — the export library could not load.");
    });
}

export function exportFindings(
  format: "csv" | "json" | "pdf",
  findings: Finding[],
  repoName: string
): Promise<void> {
  if (format === "csv") return exportCSV(findings, repoName);
  if (format === "json") return exportJSON(findings, repoName);
  return exportPDF(findings, repoName);
}
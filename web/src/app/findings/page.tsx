"use client";

import { useQuery } from "@tanstack/react-query";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  BrainCircuit,
  CheckCircle2,
  Download,
  FileCode2,
  FileText,
  Loader2,
  Radar,
  Search,
  Sparkles,
  Terminal,
  Wand2,
} from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import {
  severityOrder,
  severityStyles,
  SeverityBadge,
} from "@/lib/severity";
import type { Analysis, Finding, Severity } from "@/lib/types";
import { cn } from "@/lib/utils";
import { CopyButton } from "@/components/copy-button";
import { exportFindings } from "@/lib/export";
import { useOnboardingTour } from "@/hooks/use-onboarding-tour";
import { markTourDone, reposVisited, tourDone } from "@/lib/tour";
import { toast } from "sonner";

const sampleFindings: Finding[] = [
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

const severityBorder: Record<Severity, string> = {
  critical: "border-l-red-500",
  high: "border-l-orange-500",
  medium: "border-l-amber-500",
  low: "border-l-sky-500",
  info: "border-l-slate-500",
};

const severityGlow: Record<Severity, string> = {
  critical: "shadow-red-500/20",
  high: "shadow-orange-500/20",
  medium: "shadow-amber-500/20",
  low: "shadow-sky-500/20",
  info: "shadow-slate-500/20",
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, x: -10 },
  show: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  },
};

export default function FindingsPage() {
  return (
    <Suspense fallback={null}>
      <FindingsExplorer />
    </Suspense>
  );
}

function FindingsExplorer() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const analyses = useQuery({
    queryKey: ["analyses"],
    queryFn: api.analyses,
    refetchInterval: 5000,
  });
  const repos = useQuery({ queryKey: ["repos"], queryFn: api.repositories });

  const urlSeverity = searchParams.get("severity");
  const [selectedSeverity, setSelectedSeverity] = useState<Severity | "all">(
    urlSeverity && (severityOrder as string[]).includes(urlSeverity)
      ? (urlSeverity as Severity)
      : "all"
  );
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Finding | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (selectedSeverity === "all") params.delete("severity");
    else params.set("severity", selectedSeverity);
    const next = params.toString();
    router.replace(next ? `?${next}` : pathname, { scroll: false });
  }, [selectedSeverity, router, searchParams, pathname]);

  useOnboardingTour({
    enabled: reposVisited() && !tourDone() && pathname === "/findings",
    onComplete: markTourDone,
    steps: [
      {
        element: "[data-guide='findings-list']",
        popover: {
          title: "Findings List",
          description:
            "Every issue the scan detected lives here, ranked by severity. Select one to investigate it.",
          side: "left",
        },
      },
      {
        element: "[data-guide='findings-filter']",
        popover: {
          title: "Filter by severity",
          description:
            "Narrow the list to critical and high issues first — that's where the real risk is.",
          side: "bottom",
        },
      },
      {
        element: "[data-guide='ai-panel']",
        popover: {
          title: "AI Investigation",
          description:
            "Pick a finding to see the AI's full investigation: explanation, root cause, and a suggested patch.",
          side: "left",
        },
      },
    ],
  });

  const repoMap = useMemo(
    () => new Map((repos.data ?? []).map((r) => [r.id, r])),
    [repos.data]
  );

  const focusedId = useMemo(() => {
    const raw = searchParams.get("analysis");
    const parsed = raw ? Number(raw) : null;
    return parsed != null && Number.isFinite(parsed) ? parsed : null;
  }, [searchParams]);

  const active = useMemo(() => {
    const list = analyses.data ?? [];
    if (focusedId != null) {
      const found = list.find((a) => a.id === focusedId);
      if (found) return found;
      return {
        id: focusedId,
        repository_id: -1,
        status: "queued",
        commit_sha: null,
        error: null,
        created_at: "",
        updated_at: "",
      } as Analysis;
    }
    return list[0];
  }, [analyses.data, focusedId]);

  const scanning =
    !!active && (active.status === "queued" || active.status === "running");
  const failed = !!active && active.status === "failed";
  const apiDown = analyses.isError && analyses.data == null;

  const findingsQuery = useQuery({
    queryKey: ["findings", active?.id],
    queryFn: () => api.findings(active!.id),
    enabled: !!active,
    refetchInterval: 5000,
  });

  const findings: Finding[] = useMemo(() => {
    if (!active || scanning) return [];
    const liveFindings = findingsQuery.data ?? [];
    const isSample = active
      ? (repoMap.get(active.repository_id)?.is_sample ?? false)
      : false;
    return liveFindings.length > 0
      ? liveFindings
      : isSample
        ? sampleFindings
        : [];
  }, [findingsQuery.data, active, scanning, repoMap]);

  const activeRepo =
    active && active.repository_id >= 0
      ? repoMap.get(active.repository_id)
      : undefined;
  const isSample = activeRepo?.is_sample ?? false;

  const filtered = findings.filter((f) => {
    const sevOk = selectedSeverity === "all" || f.severity === selectedSeverity;
    const q = query.toLowerCase();
    const textOk =
      !q ||
      (f.file_path ?? "").toLowerCase().includes(q) ||
      f.message.toLowerCase().includes(q) ||
      (f.rule_id ?? "").toLowerCase().includes(q);
    return sevOk && textOk;
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of findings) c[f.severity] = (c[f.severity] ?? 0) + 1;
    return c;
  }, [findings]);

  const activeFinding = selected ?? filtered[0] ?? null;

  const handleExport = useCallback(
    (format: "csv" | "json" | "pdf") => {
      const count = filtered.length;
      if (count === 0) {
        toast.info("Nothing to export — no findings match the current filters.");
        return;
      }
      exportFindings(format, filtered, activeRepo?.name ?? "codedoc");
      toast.success(`Exported ${count} ${count === 1 ? "finding" : "findings"} as ${format.toUpperCase()}.`);
    },
    [filtered, activeRepo]
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <PageHeader
        title="Findings Explorer"
        description="Investigate findings with severity, CVSS, and AI explanations"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleExport("csv")}
            title="Download CSV"
          >
            <Download className="h-3.5 w-3.5" />
            CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleExport("json")}
            title="Download JSON"
          >
            <FileText className="h-3.5 w-3.5" />
            JSON
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleExport("pdf")}
            title="Download PDF report"
          >
            <FileText className="h-3.5 w-3.5" />
            PDF
          </Button>
        </div>
      </PageHeader>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="mb-4 flex flex-wrap items-center gap-2"
        data-guide="findings-filter"
      >
        <Button
          size="sm"
          variant={selectedSeverity === "all" ? "default" : "outline"}
          onClick={() => setSelectedSeverity("all")}
        >
          All ({findings.length})
        </Button>
        {severityOrder.map((sev) => (
          <Button
            key={sev}
            size="sm"
            variant={selectedSeverity === sev ? "default" : "outline"}
            onClick={() => setSelectedSeverity(sev)}
            className="capitalize"
          >
            {sev} ({counts[sev] ?? 0})
          </Button>
        ))}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="relative mb-4"
      >
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search by file, message, or rule…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <Card data-guide="findings-list">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Radar className="h-4 w-4 text-primary" />
                Findings
              </CardTitle>
            </CardHeader>
            <CardContent className="max-h-[70vh] space-y-2 overflow-y-auto p-4">
              {apiDown && (
                <p className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-600">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    Cannot reach the backend API on {api.baseUrl}. Start the API
                    server, then reload this page.
                  </span>
                </p>
              )}
              {failed && (
                <p className="flex items-start gap-2 rounded-md border border-red-500/30 bg-red-500/5 p-3 text-xs text-red-600">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    <span className="font-semibold">Analysis failed: </span>
                    {active?.error ?? "unknown error"}
                  </span>
                </p>
              )}
              {scanning && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Scanning {activeRepo ? `“${activeRepo.name}”` : "the repository"}…
                  results appear automatically.
                </p>
              )}
              {filtered.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {scanning
                    ? "Scanning repository… findings will appear here automatically."
                    : failed
                      ? "The analysis did not complete, so there are no findings to show."
                      : apiDown
                        ? "The backend API is not responding."
                        : isSample
                           ? "No findings match your filters."
                           : active?.status === "completed"
                             ? "Scan completed — no issues found."
                             : "No findings yet."}
                </p>
              ) : (
                <motion.div variants={container} initial="hidden" animate="show">
                  <AnimatePresence mode="popLayout">
                    {filtered.map((f) => (
                      <motion.div
                        key={f.id}
                        variants={item}
                        layout
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                      >
                        <button
                          onClick={() => setSelected(f)}
                          className={cn(
                            "w-full rounded-lg border border-l-2 p-3 text-left transition-all duration-200 ease-out-expo",
                            severityBorder[f.severity],
                            activeFinding?.id === f.id
                              ? cn(
                                  "border-primary bg-primary/5 shadow-sm",
                                  severityGlow[f.severity]
                                )
                              : "border-border/50 hover:border-border hover:bg-muted/30"
                          )}
                        >
                          <div className="flex items-center justify-between">
                            <SeverityBadge severity={f.severity} />
                            <span className="text-xs text-muted-foreground">{f.tool}</span>
                          </div>
                          <p className="mt-2 text-sm font-medium leading-snug">{f.message}</p>
                          <p className="mt-1 flex items-center gap-1 truncate font-mono text-xs text-muted-foreground">
                            <FileCode2 className="h-3 w-3 shrink-0" />
                            {f.file_path ?? "unknown"}
                            {f.line_start ? `:${f.line_start}` : ""}
                          </p>
                          {f.vulnerability?.cvss_score != null && (
                            <div className="mt-2 flex items-center gap-2 text-xs">
                              <span className="text-muted-foreground">
                                {f.vulnerability.identifier}
                              </span>
                              <Badge variant="destructive" className="gap-1">
                                CVSS {f.vulnerability.cvss_score.toFixed(1)}
                              </Badge>
                            </div>
                          )}
                        </button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
        >
          <Card className="sticky top-8" data-guide="ai-panel">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles className="h-4 w-4 text-primary" />
                AI Investigation
              </CardTitle>
            </CardHeader>
            <CardContent>
              <AnimatePresence mode="wait">
                {activeFinding ? (
                  <motion.div
                    key={activeFinding.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <SeverityBadge severity={activeFinding.severity} />
                      <span className="font-mono text-xs text-muted-foreground">
                        {activeFinding.rule_id ?? activeFinding.tool}
                      </span>
                    </div>

                    <div className="rounded-lg bg-muted p-3 font-mono text-xs">
                      <div className="flex items-center justify-between">
                        <span>
                          <span className="text-muted-foreground">
                            {activeFinding.file_path}
                          </span>
                          <span className="text-primary">
                            {activeFinding.line_start ? `:${activeFinding.line_start}` : ""}
                          </span>
                        </span>
                        <CopyButton
                          text={`${activeFinding.file_path ?? ""}${
                            activeFinding.line_start != null
                              ? `:${activeFinding.line_start}`
                              : ""
                          }`}
                          label="Copy location"
                        />
                      </div>
                      <pre className="mt-2 whitespace-pre-wrap text-foreground">
                        {activeFinding.message}
                      </pre>
                    </div>

                    <div className="mt-5 space-y-1">
                      <Step
                        icon={Terminal}
                        tone="text-primary"
                        title="Detected"
                        done
                      >
                        Found by{" "}
                        <span className="font-medium text-foreground">
                          {activeFinding.tool}
                        </span>{" "}
                        at
                        <span className="ml-1 font-mono text-xs">
                          {activeFinding.file_path ?? "unknown"}
                          {activeFinding.line_start ? `:${activeFinding.line_start}` : ""}
                        </span>
                      </Step>

                      <Step
                        icon={BrainCircuit}
                        tone="text-sky-400"
                        title="Summary Agent · Explanation"
                        done={!!activeFinding.ai_explanation}
                      >
                        {activeFinding.ai_explanation ??
                          "No AI explanation yet. Download the Summary Agent or run an analysis to generate it."}
                      </Step>

                      {activeFinding.root_cause ? (
                        <Step
                          icon={Wand2}
                          tone="text-amber-400"
                          title="Debug Agent · Root cause"
                          done
                        >
                          {activeFinding.root_cause}
                        </Step>
                      ) : (
                        <Step
                          icon={Wand2}
                          tone="text-amber-400"
                          title="Debug Agent · Root cause"
                          done={false}
                        >
                          Root-cause analysis lands once the Debug Agent runs on this finding.
                        </Step>
                      )}

                      <Step
                        icon={FileCode2}
                        tone="text-emerald-400"
                        title="Patch Agent · Suggestion"
                        done={false}
                      >
                        A production-ready diff with sandbox tests will appear here — and can be
                        opened straight as a GitHub PR.
                      </Step>
                    </div>

                    {findingsQuery.isLoading && (
                      <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Loading live findings…
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    Select a finding to see its AI investigation.
                  </motion.p>
                )}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

function Step({
  icon: Icon,
  tone,
  title,
  done,
  children,
}: {
  icon: React.ElementType;
  tone: string;
  title: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 rounded-lg border border-border/50 bg-muted/20 p-3">
      {done ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
      ) : (
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", tone)} />
      )}
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </h4>
        <p className="mt-0.5 font-mono text-xs leading-relaxed text-foreground/90">
          {children}
        </p>
      </div>
    </div>
  );
}
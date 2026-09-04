"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Compass,
  GitBranch,
  Hammer,
  ListChecks,
  Rocket,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";

type Section =
  | {
      id: string;
      kind: "steps";
      title: string;
      icon: React.ElementType;
      description: string;
      steps: string[];
    }
  | {
      id: string;
      kind: "labels";
      title: string;
      icon: React.ElementType;
      description: string;
      labels: { label: string; value: string }[];
    }
  | {
      id: string;
      kind: "items";
      title: string;
      icon: React.ElementType;
      description: string;
      items: { title: string; body: string }[];
    };

const sections: Section[] = [
  {
    id: "get-started",
    kind: "items",
    title: "What CodeDoc can do",
    icon: Sparkles,
    description:
      "CodeDoc is a self-hostable AI codebase doctor. It clones a repository, scans it for " +
      "vulnerabilities, bugs, and dependency risk, and explains each finding with a root cause " +
      "and patch suggestion.",
    items: [
      {
        title: "Connect a repository",
        body:
          "Paste any public Git URL on the Repositories page. The URL is verified on add; if it " +
          "is not a reachable existing repo you are told to enter a proper one. The repo file " +
          "count and size are computed right away.",
      },
      {
        title: "Analyze a repo",
        body:
          "Click Analyze on a repository to run a scan. Findings appear live on the Findings " +
          "page, sorted by severity (info to critical), with AI explanations, root causes, and " +
          "patch suggestions.",
      },
      {
        title: "Try the sample",
        body:
          "No repo handy? Click TRY SAMPLE REPOSITORY to scan a known-vulnerable demo repo and " +
          "see the full flow instantly.",
      },
      {
        title: "Check platform health",
        body:
          "The Integrations page shows which providers (LLM, search, vulnerability data, vector " +
          "store) are active and their usage.",
      },
    ],
  },
  {
    id: "do",
    kind: "steps",
    title: "Suggested workflow",
    icon: Compass,
    description: "A typical way to get value out of CodeDoc, from zero to patched findings.",
    steps: [
      "Open Repositories and add a public Git URL (or use the sample).",
      "Click Analyze on the repo you care about.",
      "Wait for the scan; findings stream in and you are redirected to the Findings page.",
      "Filter by severity and open a finding to read its root cause and patch suggestion.",
      "Export the report (CSV/JSON/PDF) to share with your team.",
    ],
  },
  {
    id: "limits",
    kind: "labels",
    title: "Demo limits (LITE)",
    icon: TriangleAlert,
    description:
      "The public demo enforces safety limits so one run cannot take down the instance.",
    labels: [
      { label: "Repo size", value: "at most 256 MB" },
      { label: "Files per repo", value: "at most 5,000" },
      { label: "Concurrent analyses / user", value: "1" },
      { label: "Analysis timeout", value: "10 minutes" },
    ],
  },
  {
    id: "how",
    kind: "items",
    title: "How the scan works",
    icon: Hammer,
    description:
      "In the demo, analysis runs a dependency-light heuristic scanner (no network beyond cloning):",
    items: [
      {
        title: "Secret and key detection",
        body:
          "Pattern-matches AWS keys, OpenAI keys, GitHub tokens, and more. Any secret that would " +
          "leave the sandbox is redacted first.",
      },
      {
        title: "Dependency risk",
        body:
          "Manifests are checked against a bundled table of known-vulnerable dependency versions.",
      },
      {
        title: "Deterministic rules",
        body:
          "Flagged patterns for insecure code so results are reproducible without an LLM.",
      },
    ],
  },
  {
    id: "roadmap",
    kind: "items",
    title: "Not yet built (roadmap)",
    icon: Clock,
    description:
      "The live product is the LITE demo. These are the planned, not-yet-shipped features:",
    items: [
      {
        title: "Deeper analysis engine",
        body:
          "Tree-sitter/AST parsing, code graph and embeddings, real Semgrep/Bandit/Ruff/eslint/" +
          "Gitleaks/Trivy wrappers.",
      },
      {
        title: "Agent teams (Patch / Debug / Summary)",
        body:
          "LangGraph agents that propose patches, run sandbox tests, and can open pull requests.",
      },
      {
        title: "Dependency and config pages wired to the API",
        body:
          "Dependency security report and Settings provider toggles are currently static/UI-only.",
      },
      {
        title: "Live OSV / NVD / GitHub Advisory data",
        body:
          "The bundled offline vulnerability table will be upgraded to live, always-fresh data.",
      },
      {
        title: "Webhooks and incremental analysis",
        body:
          "GitHub webhooks for push / PR / issues that trigger re-scans of just what changed.",
      },
      {
        title: "Auth and real accounts",
        body:
          "Local accounts plus GitHub OAuth to replace the dev bootstrap user.",
      },
      {
        title: "Observability and voice",
        body:
          "OpenTelemetry, GlitchTip/Sentry, /metrics dashboards, and optional voice (TTS/STT) in FULL mode.",
      },
    ],
  },
];

function SectionCard({ section }: { section: Section }) {
  return (
    <motion.section
      id={section.id}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.35 }}
      className="scroll-mt-20"
    >
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <section.icon className="h-4 w-4" />
            </span>
            {section.title}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{section.description}</p>
        </CardHeader>
        <CardContent className="space-y-4 pt-0">
          {section.kind === "steps" && (
            <ol className="space-y-2">
              {section.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span className="text-muted-foreground">{step}</span>
                </li>
              ))}
            </ol>
          )}
          {section.kind === "labels" && (
            <div className="grid gap-3 sm:grid-cols-2">
              {section.labels.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2.5 text-sm"
                >
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          )}
          {section.kind === "items" && (
            <div className="space-y-4">
              {section.items.map((item, i) => (
                <div key={i} className="rounded-lg border border-border/50 p-4">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    {item.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </motion.section>
  );
}

export default function DocsPage() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-6"
    >
      <PageHeader
        title="Docs"
        description="What you can do, how to do it, and what's still on the roadmap"
      >
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            <BookOpen className="mr-1 h-3 w-3" />
            LITE demo
          </Badge>
          <Button asChild size="sm">
            <Link href="/repositories">
              Get started
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <nav className="lg:col-span-1">
          <Card className="lg:sticky lg:top-20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-4 w-4" />
                On this page
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 pt-0 text-sm">
              {sections.map((s) => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
                >
                  <s.icon className="h-4 w-4" />
                  {s.title}
                </a>
              ))}
            </CardContent>
          </Card>
        </nav>

        <div className="space-y-6 lg:col-span-2">
          {sections.map((section) => (
            <SectionCard key={section.id} section={section} />
          ))}
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Rocket className="h-5 w-5" />
            </div>
            <div>
              <p className="flex items-center gap-2 font-medium">
                <GitBranch className="h-4 w-4" />
                Ready to run your first scan?
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a public Git repository or try the sample to see CodeDoc in action.
              </p>
            </div>
          </div>
          <Button asChild className="shrink-0">
            <Link href="/repositories">
              Go to Repositories
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}

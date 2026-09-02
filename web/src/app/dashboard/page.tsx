"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  Gauge,
  Plug,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes, relativeTime, severityOrder } from "@/lib/severity";
import type { Severity } from "@/lib/types";
import { cn } from "@/lib/utils";

const severitySegment: Record<Severity, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-sky-500",
  info: "bg-slate-500",
};

const statAccent: Record<string, string> = {
  sky: "bg-sky-500/10 text-sky-400",
  primary: "bg-primary/10 text-primary",
  amber: "bg-amber-500/10 text-amber-400",
  emerald: "bg-emerald-500/10 text-emerald-400",
};

function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  hint?: string;
  accent: string;
}) {
  return (
    <Card className="relative overflow-hidden">
      <span
        className={cn(
          "absolute inset-y-0 left-0 w-0.5 bg-gradient-to-b from-sky-400 to-teal-300",
          accent.includes("amber") && "from-amber-400 to-orange-300",
          accent.includes("emerald") && "from-emerald-400 to-teal-300",
          accent.includes("sky") && "from-sky-400 to-cyan-300"
        )}
      />
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="mt-1 font-display text-2xl font-bold tracking-tight">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-md",
            statAccent[accent]
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const health = useQuery({ queryKey: ["health"], queryFn: api.health });
  const repositories = useQuery({ queryKey: ["repos"], queryFn: api.repositories });
  const analyses = useQuery({ queryKey: ["analyses"], queryFn: api.analyses });
  const integrations = useQuery({
    queryKey: ["integrations"],
    queryFn: api.integrationStatus,
  });

  const initialLoading = health.isPending || repositories.isPending || analyses.isPending;

  const repoList = repositories.data ?? [];
  const analysisList = analyses.data ?? [];
  const completed = analysisList.filter((a) => a.status === "completed").length;
  const running = analysisList.filter((a) => a.status === "running" || a.status === "queued");
  const totalBytes = repoList.reduce((sum, r) => sum + (r.size_bytes ?? 0), 0);
  const totalFiles = repoList.reduce((sum, r) => sum + (r.file_count ?? 0), 0);
  const healthStatusOk = health.data?.status === "ok";
  const status = health.data?.status ?? "unknown";

  const latestCompleted = analysisList.find((a) => a.status === "completed");
  const latestFindings = useQuery({
    queryKey: ["findings", latestCompleted?.id],
    queryFn: () => api.findings(latestCompleted!.id),
    enabled: !!latestCompleted,
  });
  const severityCounts: Record<Severity, number> = useMemo(() => {
    const counts: Record<Severity, number> = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };
    for (const f of latestFindings.data ?? []) counts[f.severity] += 1;
    return counts;
  }, [latestFindings.data]);
  const totalFindings = latestFindings.data?.length ?? 0;
  const totalSeverity = severityOrder.reduce((sum, s) => sum + severityCounts[s], 0);
  const lateStageScore = Math.round(
    severityOrder.reduce(
      (score, sev, i) => score + severityCounts[sev] * (i + 1),
      0
    ) / Math.max(1, totalSeverity)
  );
  const riskLabel =
    lateStageScore >= 4.5
      ? "High risk"
      : lateStageScore >= 3
        ? "Elevated risk"
        : lateStageScore > 0
          ? "Moderate risk"
          : "No issues detected";

  const latestRepo = latestCompleted
    ? repoList.find((r) => r.id === latestCompleted.repository_id)
    : undefined;

  const recentAnalyses = analysisList.slice(0, 6);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Overview of your repositories, analyses, and platform health"
      >
        <div className="flex items-center gap-2">
          <Badge variant={healthStatusOk ? "success" : "destructive"}>
            <CheckCircle2 className="mr-1 h-3 w-3" />
            {healthStatusOk ? "API Healthy" : "API Degraded"}
          </Badge>
          <Button asChild size="sm">
            <Link href="/repositories">
              New Analysis
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </PageHeader>

      {initialLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5">
                <Skeleton className="mb-2 h-3 w-24" />
                <Skeleton className="h-7 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          <Card className="relative overflow-hidden">
            <span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-sky-400 via-primary to-teal-300" />
            <CardContent className="grid gap-6 p-6 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Latest scan
                  {latestRepo ? ` · ${latestRepo.name}` : ""}
                </p>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="font-display text-5xl font-bold tracking-tight text-gradient">
                    {totalFindings}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {totalFindings === 1 ? "finding" : "findings"} detected
                  </span>
                </div>
                <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                  {latestCompleted
                    ? `Scan ${latestCompleted.id} completed ${relativeTime(
                        latestCompleted.created_at
                      )} across ${totalFiles.toLocaleString()} files · ${formatBytes(
                        totalBytes
                      )}.`
                    : "Run your first analysis to populate the risk overview."}
                </p>
                <div className="mt-4 flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Risk model:</span>
                  <Badge
                    variant={
                      lateStageScore >= 3.5
                        ? "destructive"
                        : lateStageScore > 0
                          ? "warning"
                          : "success"
                    }
                  >
                    <ShieldAlert className="mr-1 h-3 w-3" />
                    {riskLabel}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    score {lateStageScore.toFixed(1)}/5
                  </span>
                </div>
              </div>
              <div className="flex flex-col justify-center">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Severity breakdown
                </p>
                <div className="severity-bar">
                  {totalSeverity === 0 ? (
                    <div className="h-2 w-full rounded-full bg-muted" />
                  ) : (
                    severityOrder.map((sev) =>
                      severityCounts[sev] > 0 ? (
                        <div
                          key={sev}
                          className={cn("h-2 first:rounded-l-full last:rounded-r-full", severitySegment[sev])}
                          style={{ width: `${(severityCounts[sev] / totalSeverity) * 100}%` }}
                          title={`${sev}: ${severityCounts[sev]}`}
                        />
                      ) : null
                    )
                  )}
                </div>
                <div className="mt-3 grid grid-cols-5 gap-1 text-center">
                  {severityOrder.map((sev) => (
                    <div key={sev} className="text-xs">
                      <div className="flex items-center justify-center gap-1">
                        <span className={cn("h-1.5 w-1.5 rounded-full", severitySegment[sev])} />
                        <span className="font-semibold text-foreground">{severityCounts[sev]}</span>
                      </div>
                      <span className="text-muted-foreground">{sev}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={Boxes}
              label="Repositories"
              value={String(repoList.length)}
              hint={`${formatBytes(totalBytes)} tracked`}
              accent="sky"
            />
            <StatCard
              icon={Gauge}
              label="Analyses"
              value={String(analysisList.length)}
              hint={`${completed} completed`}
              accent="primary"
            />
            <StatCard
              icon={Activity}
              label="Active Jobs"
              value={String(running.length)}
              hint={running.length ? "in progress" : "idle"}
              accent="amber"
            />
            <StatCard
              icon={Sparkles}
              label="Active LLM"
              value={String(integrations.data?.active_llm ?? "—")}
              hint={`${totalFiles.toLocaleString()} files indexed`}
              accent="emerald"
            />
          </div>
        </>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Recent Analyses
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {recentAnalyses.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No analyses yet. Run your first analysis to see findings here.
              </p>
            ) : (
              <div className="space-y-1">
                {recentAnalyses.map((a) => {
                  const repo = repoList.find((r) => r.id === a.repository_id);
                  const statusTone =
                    a.status === "completed"
                      ? "bg-emerald-400"
                      : a.status === "failed"
                        ? "bg-red-500"
                        : "bg-amber-400 animate-breathe";
                  return (
                    <div key={a.id} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors duration-200 hover:bg-muted/30">
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", statusTone)} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {repo?.name ?? `Analysis #${a.id}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {a.commit_sha ? `@ ${a.commit_sha.slice(0, 7)} · ` : ""}
                          {relativeTime(a.created_at)}
                        </p>
                      </div>
                      <Badge
                        variant={
                          a.status === "completed"
                            ? "success"
                            : a.status === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {a.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-4 w-4 text-primary" />
              Integrations
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2 text-sm">
              {integrations.data ? (
                Object.entries(integrations.data.providers).map(([key, name]) => (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-md px-2 py-1.5"
                  >
                    <span className="text-muted-foreground">{key}</span>
                    <span className="font-medium">{name}</span>
                  </div>
                ))
              ) : (
                <p className="text-muted-foreground">No integration data.</p>
              )}
            </div>
            <div className="mt-4">
              <Button variant="outline" size="sm" asChild>
                <Link href="/integrations">View all</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {status === "unknown" && !initialLoading && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span>
            The backend API is not responding. Start the API server to load live
            data, or check platform health on the Integrations page.
          </span>
          <Button size="sm" variant="outline" asChild className="ml-auto shrink-0">
            <Link href="/integrations">Check</Link>
          </Button>
        </div>
      )}
    </div>
  );
}
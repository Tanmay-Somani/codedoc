import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
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
import { formatBytes, relativeTime, severityStyles } from "@/lib/severity";
import type { Severity } from "@/lib/types";

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
  accent?: string;
}) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between p-5">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold">{value}</p>
          {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-md ${
            accent ?? "bg-primary/10 text-primary"
          }`}
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
  const status = health.data?.status ?? "unknown";
  const isHealthy = status === "ok";

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
  const latestRepo = latestCompleted
    ? repoList.find((r) => r.id === latestCompleted.repository_id)
    : undefined;

  const recentAnalyses = analysisList.slice(0, 6);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your repositories, analyses, and platform health"
      >
        <div className="flex items-center gap-2">
          <Badge variant={isHealthy ? "success" : "destructive"}>
            <CheckCircle2 className="mr-1 h-3 w-3" />
            {isHealthy ? "API Healthy" : "API Degraded"}
          </Badge>
          <Button asChild size="sm">
            <Link href="/repositories">New Analysis</Link>
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {initialLoading ? (
          <>
            {Array.from({ length: 4 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-5">
                  <Skeleton className="mb-2 h-3 w-24" />
                  <Skeleton className="h-7 w-16" />
                </CardContent>
              </Card>
            ))}
          </>
        ) : (
          <>
            <StatCard
              icon={Boxes}
              label="Repositories"
              value={String(repoList.length)}
              hint={`${formatBytes(totalBytes)} tracked`}
              accent="bg-sky-500/10 text-sky-600"
            />
            <StatCard
              icon={Gauge}
              label="Analyses"
              value={String(analysisList.length)}
              hint={`${completed} completed`}
              accent="bg-primary/10 text-primary"
            />
            <StatCard
              icon={Activity}
              label="Active Jobs"
              value={String(running.length)}
              hint={running.length ? "in progress" : "idle"}
              accent="bg-amber-500/10 text-amber-600"
            />
            <StatCard
              icon={Sparkles}
              label="Active LLM"
              value={String(integrations.data?.active_llm ?? "—")}
              hint={`${totalFiles.toLocaleString()} files indexed`}
              accent="bg-emerald-500/10 text-emerald-600"
            />
          </>
        )}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
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
              <div className="divide-y">
                {recentAnalyses.map((a) => {
                  const repo = repoList.find((r) => r.id === a.repository_id);
                  return (
                    <div key={a.id} className="flex items-center justify-between py-3">
                      <div className="min-w-0">
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

      <div className="mt-6">
        <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <ShieldAlert className="h-4 w-4 text-muted-foreground" />
          Findings by severity
          {latestRepo && (
            <span className="font-normal text-muted-foreground">
              · latest scan of {latestRepo.name}
            </span>
          )}
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {(Object.keys(severityStyles) as Severity[]).map((sev) => (
            <Card key={sev} className="flex items-center justify-between p-4">
              <span className="flex items-center gap-2 text-sm capitalize font-medium">
                <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                {sev}
              </span>
              <Badge className={severityStyles[sev]}>
                {severityCounts[sev]}
              </Badge>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
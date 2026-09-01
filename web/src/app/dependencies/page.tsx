"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowUpRight,
  Box,
  Package as PackageIcon,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { api } from "@/lib/api";
import { SeverityBadge } from "@/lib/severity";
import type { Finding, Severity } from "@/lib/types";

interface DependencyRow {
  key: number;
  name: string;
  ecosystem: string;
  version: string;
  fixed: string | null;
  identifier: string;
  cvss: number | null;
  severity: Severity;
}

const colorMap: Record<Severity, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#0ea5e9",
  info: "#94a3b8",
};

export default function DependenciesPage() {
  const analyses = useQuery({
    queryKey: ["analyses"],
    queryFn: api.analyses,
    refetchInterval: 5000,
  });

  const latestCompleted = (analyses.data ?? []).find(
    (a) => a.status === "completed"
  );

  const findings = useQuery({
    queryKey: ["findings", latestCompleted?.id],
    queryFn: () => api.findings(latestCompleted!.id),
    enabled: !!latestCompleted,
    refetchInterval: 5000,
  });

  const rows: DependencyRow[] = useMemo(() => {
    return (findings.data ?? [])
      .filter((f: Finding) => f.tool === "dependency")
      .map((f) => {
        const raw = f.raw_data ?? {};
        return {
          key: f.id,
          name: raw.package ?? f.message,
          ecosystem: raw.ecosystem ?? "—",
          version: raw.version ?? "?",
          fixed: f.vulnerability?.patched_versions?.[0] ?? raw.fixed_version ?? null,
          identifier: f.vulnerability?.identifier ?? raw.identifier ?? "—",
          cvss: f.vulnerability?.cvss_score ?? raw.cvss_score ?? null,
          severity: f.severity,
        };
      });
  }, [findings.data]);

  const total = rows.length;
  const fixAvailable = rows.filter((r) => r.fixed).length;

  const chartData = (Object.keys(colorMap) as Severity[]).map((sev) => ({
    name: sev,
    count: rows.filter((r) => r.severity === sev).length,
  }));

  return (
    <div>
      <PageHeader
        title="Dependency Security"
        description="Known-vulnerable dependencies detected in your latest repo scan"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Vulnerable deps</p>
              <p className="mt-1 text-2xl font-bold">{total}</p>
            </div>
            <PackageIcon className="h-6 w-6 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Vulnerable</p>
              <p className="mt-1 text-2xl font-bold text-red-500">{total}</p>
            </div>
            <ShieldAlert className="h-6 w-6 text-red-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Fix available</p>
              <p className="mt-1 text-2xl font-bold text-emerald-500">{fixAvailable}</p>
            </div>
            <ShieldCheck className="h-6 w-6 text-emerald-500" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Detected vulnerabilities</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {!latestCompleted ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No scans yet. Run an analysis to see dependency findings.
              </p>
            ) : rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No known-vulnerable dependencies found in the latest scan.
              </p>
            ) : (
              <div className="divide-y">
                {rows.map((d) => (
                  <div
                    key={d.key}
                    className="flex items-center justify-between gap-3 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Box className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{d.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.identifier}
                          {d.cvss != null && ` · CVSS ${d.cvss}`} · {d.ecosystem}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {d.version}
                        {d.fixed ? ` → fix ${d.fixed}` : ""}
                      </span>
                      <SeverityBadge severity={d.severity} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Severity Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {chartData.map((entry) => (
                      <Cell key={entry.name} fill={colorMap[entry.name as Severity]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldQuestion className="h-4 w-4 text-primary" />
                Remediation
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="font-medium">
                  <Badge variant="warning" className="mr-2">Patch Agent</Badge>
                  Generate a patch
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Produce a production-ready upgrade diff with sandbox tests.
                </p>
              </div>
              <ButtonLink href="#patch">Open pull request</ButtonLink>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ButtonLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
    >
      {children}
      <ArrowUpRight className="h-3.5 w-3.5" />
    </a>
  );
}
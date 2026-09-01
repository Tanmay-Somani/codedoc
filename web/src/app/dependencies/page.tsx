"use client";

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
import { SeverityBadge } from "@/lib/severity";
import type { Severity } from "@/lib/types";

interface Dependency {
  name: string;
  ecosystem: string;
  version: string;
  latest: string;
  severity: Severity;
  cvss: number | null;
  identifier: string;
  status: "patched" | "outdated" | "vulnerable" | "ok";
}

const dependencies: Dependency[] = [
  {
    name: "fastapi",
    ecosystem: "pypi",
    version: "0.110.0",
    latest: "0.115.4",
    severity: "high",
    cvss: 8.1,
    identifier: "CVE-2024-24762",
    status: "vulnerable",
  },
  {
    name: "starlette",
    ecosystem: "pypi",
    version: "0.36.2",
    latest: "0.41.3",
    severity: "high",
    cvss: 7.5,
    identifier: "GHSA-6q63-8vv6-m9g4",
    status: "vulnerable",
  },
  {
    name: "httpx",
    ecosystem: "pypi",
    version: "0.26.0",
    latest: "0.27.2",
    severity: "critical",
    cvss: 9.8,
    identifier: "CVE-2024-XXXX",
    status: "vulnerable",
  },
  {
    name: "pydantic",
    ecosystem: "pypi",
    version: "2.5.0",
    latest: "2.9.2",
    severity: "medium",
    cvss: 5.3,
    identifier: "CVE-2024-3772",
    status: "patched",
  },
  {
    name: "sqlalchemy",
    ecosystem: "pypi",
    version: "2.0.29",
    latest: "2.0.36",
    severity: "low",
    cvss: 3.7,
    identifier: "GHSA-XXXX",
    status: "outdated",
  },
  {
    name: "jinja2",
    ecosystem: "pypi",
    version: "3.1.3",
    latest: "3.1.4",
    severity: "info",
    cvss: null,
    identifier: "—",
    status: "ok",
  },
];

const colorMap: Record<Severity, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#f59e0b",
  low: "#0ea5e9",
  info: "#94a3b8",
};

const chartData = (Object.keys(colorMap) as Severity[]).map((sev) => {
  const count = dependencies.filter((d) => d.severity === sev).length;
  return { name: sev, count };
});

export default function DependenciesPage() {
  const total = dependencies.length;
  const vulnerable = dependencies.filter((d) => d.status === "vulnerable").length;
  const patched = dependencies.filter((d) => d.status === "patched").length;

  return (
    <div>
      <PageHeader
        title="Dependency Security"
        description="OSV + NVD + GitHub Advisory intelligence merged and scored by CVSS"
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Dependencies</p>
              <p className="mt-1 text-2xl font-bold">{total}</p>
            </div>
            <PackageIcon className="h-6 w-6 text-muted-foreground" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Vulnerable</p>
              <p className="mt-1 text-2xl font-bold text-red-500">{vulnerable}</p>
            </div>
            <ShieldAlert className="h-6 w-6 text-red-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Patched</p>
              <p className="mt-1 text-2xl font-bold text-emerald-500">{patched}</p>
            </div>
            <ShieldCheck className="h-6 w-6 text-emerald-500" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Findings</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="divide-y">
              {dependencies.map((d) => (
                <div
                  key={d.name}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Box className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{d.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {d.identifier} · {d.ecosystem}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {d.version} → {d.latest}
                    </span>
                    <SeverityBadge severity={d.severity} />
                  </div>
                </div>
              ))}
            </div>
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

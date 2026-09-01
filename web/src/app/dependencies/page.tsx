"use client";

import { motion } from "framer-motion";
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
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function DependenciesPage() {
  const total = dependencies.length;
  const vulnerable = dependencies.filter((d) => d.status === "vulnerable").length;
  const patched = dependencies.filter((d) => d.status === "patched").length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <PageHeader
        title="Dependency Security"
        description="OSV + NVD + GitHub Advisory intelligence merged and scored by CVSS"
      />

      <motion.div
        className="mb-6 grid gap-4 sm:grid-cols-3"
        variants={container}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={item}>
          <Card>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Dependencies</p>
                <p className="mt-1 text-2xl font-bold tracking-tight">{total}</p>
              </div>
              <PackageIcon className="h-6 w-6 text-muted-foreground" />
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={item}>
          <Card>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Vulnerable</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-red-400">{vulnerable}</p>
              </div>
              <ShieldAlert className="h-6 w-6 text-red-400" />
            </CardContent>
          </Card>
        </motion.div>
        <motion.div variants={item}>
          <Card>
            <CardContent className="flex items-center justify-between p-5">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Patched</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-emerald-400">{patched}</p>
              </div>
              <ShieldCheck className="h-6 w-6 text-emerald-400" />
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Findings</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <motion.div
                className="divide-y divide-border/50"
                variants={container}
                initial="hidden"
                animate="show"
              >
                {dependencies.map((d) => (
                  <motion.div
                    key={d.name}
                    variants={item}
                    className="flex items-center justify-between gap-3 py-3 group hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors duration-200"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Box className="h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 group-hover:scale-110" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{d.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {d.identifier} · {d.ecosystem}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-mono">
                        {d.version} → {d.latest}
                      </span>
                      <SeverityBadge severity={d.severity} />
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="space-y-6"
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Severity Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, duration: 0.4 }}
              >
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {chartData.map((entry) => (
                        <Cell key={entry.name} fill={colorMap[entry.name as Severity]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
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
        </motion.div>
      </div>
    </motion.div>
  );
}

function ButtonLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline transition-colors duration-200"
    >
      {children}
      <ArrowUpRight className="h-3.5 w-3.5" />
    </a>
  );
}

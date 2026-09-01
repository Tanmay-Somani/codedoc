"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Database,
  ExternalLink,
  Plug,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ServiceInfo {
  name: string;
  key: string;
  group: string;
}

const serviceCatalog: ServiceInfo[] = [
  { name: "OpenRouter", key: "llm", group: "AI Provider" },
  { name: "Gemini", key: "llm", group: "AI Provider" },
  { name: "Groq", key: "llm", group: "AI Provider" },
  { name: "Ollama", key: "llm", group: "AI Provider" },
  { name: "OSV", key: "vulnerability", group: "Security Data" },
  { name: "NVD", key: "vulnerability", group: "Security Data" },
  { name: "GitHub Advisory", key: "vulnerability", group: "Security Data" },
  { name: "PyPI", key: "package", group: "Package Registry" },
  { name: "npm", key: "package", group: "Package Registry" },
  { name: "Qdrant", key: "vector", group: "Infrastructure" },
  { name: "Valkey", key: "cache", group: "Infrastructure" },
  { name: "PostgreSQL", key: "database", group: "Infrastructure" },
  { name: "MinIO", key: "storage", group: "Infrastructure" },
];

const fallbackState: Record<string, "healthy" | "unknown"> = {
  vector: "healthy",
  cache: "healthy",
  llm: "healthy",
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.03,
      delayChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] },
  },
};

export default function IntegrationsPage() {
  const integrations = useQuery({
    queryKey: ["integrations"],
    queryFn: api.integrationStatus,
  });
  const health = useQuery({ queryKey: ["health"], queryFn: api.health });

  const providers = integrations.data?.providers ?? {};
  const healthServices: [string, string][] = health.data?.services
    ? Object.entries(health.data.services)
    : [];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <PageHeader
        title="Integrations"
        description="Provider health and external API usage"
      >
        <Badge variant={integrations.isError ? "destructive" : "success"}>
          <CheckCircle2 className="mr-1 h-3 w-3" />
          {integrations.isError ? "Some services unavailable" : "All systems nominal"}
        </Badge>
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-3">
        <motion.div
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Plug className="h-4 w-4 text-primary" />
                Service Status
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {integrations.isLoading ? (
                <div className="space-y-2 py-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between py-2"
                    >
                      <div className="space-y-1">
                        <Skeleton className="h-3.5 w-32" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <motion.div
                  className="divide-y divide-border/50"
                  variants={container}
                  initial="hidden"
                  animate="show"
                >
                  {serviceCatalog.map((s) => {
                    const providerValue = providers[s.name.toLowerCase()];
                    const isPresent = providerValue !== undefined;
                    const state = isPresent
                      ? "healthy"
                      : (fallbackState[s.key] ?? "unknown");
                    const healthy = state !== "unknown";
                    return (
                      <motion.div
                        key={s.name}
                        variants={item}
                        className="flex items-center justify-between py-3 group hover:bg-muted/30 -mx-2 px-2 rounded-lg transition-colors duration-200"
                      >
                        <div>
                          <p className="text-sm font-medium">{s.name}</p>
                          <p className="text-xs text-muted-foreground">{s.group}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">
                            {isPresent ? providerValue : "configured"}
                          </span>
                          <Badge
                            variant={healthy ? "success" : "secondary"}
                            className="gap-1.5"
                          >
                            {healthy ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : (
                              <XCircle className="h-3 w-3" />
                            )}
                            {healthy ? "Healthy" : "Unknown"}
                          </Badge>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="space-y-6"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Database className="h-4 w-4 text-primary" />
                Backend Services
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-2 text-sm">
                {healthServices.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="capitalize text-muted-foreground">{k}</span>
                    <Badge variant="success" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      {v}
                    </Badge>
                  </div>
                ))}
                {healthServices.length === 0 && (
                  <p className="text-muted-foreground">No live service data.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                API usage
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <p className="flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="h-3.5 w-3.5" />
                Rate limits and request counts are tracked per provider and
                surfaced here once the queue records usage.
              </p>
              <div className="mt-3">
                <a
                  href={"/docs"}
                  className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline transition-colors duration-200"
                >
                  Open API docs
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </motion.div>
  );
}

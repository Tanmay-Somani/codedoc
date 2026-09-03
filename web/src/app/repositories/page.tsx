"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Boxes,
  Copy,
  Eye,
  FolderGit2,
  GitBranch,
  Loader2,
  Plus,
  Rocket,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes, relativeTime } from "@/lib/severity";
import type { Analysis, Repository } from "@/lib/types";
import { useOnboardingTour } from "@/hooks/use-onboarding-tour";
import { useActiveAnalyses } from "@/hooks/use-active-analyses";
import { markReposVisited, tourDone } from "@/lib/tour";
import { fadeUpItem, staggerContainer } from "@/lib/animations";
import { toast } from "sonner";

function RepositoriesRoute() {
  const searchParams = useSearchParams();
  const tour = searchParams.get("tour");
  return <RepositoriesExplorer key={tour ?? "default"} />;
}

export default function RepositoriesPage() {
  return (
    <Suspense fallback={null}>
      <RepositoriesRoute />
    </Suspense>
  );
}

function RepositoriesExplorer() {
  const qc = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const forceTour = searchParams.get("tour") === "1";

  useOnboardingTour({
    enabled: !tourDone() || forceTour,
    steps: [
      {
        popover: {
          title: "Welcome to CodeDoc",
          description:
            "An AI codebase doctor that scans repositories for vulnerabilities, bugs, and dependency risk — then explains each finding with root causes and patch suggestions.",
          side: "bottom",
        },
      },
      {
        element: "[data-guide='connect-form']",
        popover: {
          title: "Connect a repository",
          description:
            "Paste any public Git URL to clone and analyze it. No credentials needed.",
          side: "bottom",
        },
      },
      {
        element: "[data-guide='try-sample']",
        popover: {
          title: "Try the sample",
          description:
            "New here? Click TRY SAMPLE REPOSITORY to instantly scan a known-vulnerable demo repo and see the whole flow in action.",
          side: "bottom",
          showButtons: ["next"],
        },
      },
    ],
  });

  const visitedRef = useRef(false);
  useEffect(() => {
    if (!visitedRef.current) {
      visitedRef.current = true;
      markReposVisited();
    }
  }, []);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [error, setError] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Repository | null>(null);
  const [creatingSample, setCreatingSample] = useState(false);

  const repos = useQuery({ queryKey: ["repos"], queryFn: api.repositories });
  const { analyses } = useActiveAnalyses();

  const activeAnalysisByRepo = useMemo(() => {
    const m = new Map<number, Analysis>();
    for (const a of analyses.data ?? []) {
      if (
        (a.status === "queued" || a.status === "running") &&
        !m.has(a.repository_id)
      ) {
        m.set(a.repository_id, a);
      }
    }
    return m;
  }, [analyses.data]);

  const sampleRepo = (repos.data ?? []).find((r) => r.is_sample);
  const sampleActive = sampleRepo
    ? activeAnalysisByRepo.get(sampleRepo.id)
    : undefined;

  const createRepo = useMutation({
    mutationFn: api.createRepository,
    onSuccess: (repo) => {
      setName("");
      setUrl("");
      setError(null);
      qc.invalidateQueries({ queryKey: ["repos"] });
      toast.success(`Added ${repo.name} — click Analyze to start scanning.`);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Failed to add repository";
      setError(msg);
      toast.error(msg);
    },
  });

  const runAnalysis = useMutation({
    mutationFn: api.createAnalysis,
    onSuccess: (analysis) => {
      qc.invalidateQueries({ queryKey: ["analyses"] });
      toast.info("Analysis started — you'll be redirected to live findings.");
      router.push(`/findings?analysis=${analysis.id}`);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Failed to start analysis";
      setError(msg);
      toast.error(msg);
    },
  });

  const startAnalysis = (repositoryId: number) => {
    const active = activeAnalysisByRepo.get(repositoryId);
    if (active) {
      router.push(`/findings?analysis=${active.id}`);
      return;
    }
    setAnalyzingId(repositoryId);
    setError(null);
    runAnalysis.mutate(
      { repository_id: repositoryId },
      { onSettled: () => setAnalyzingId(null) }
    );
  };

  const handleSample = () => {
    setError(null);
    if (sampleRepo && sampleActive) {
      router.push(`/findings?analysis=${sampleActive.id}`);
      return;
    }
    if (sampleRepo) {
      startAnalysis(sampleRepo.id);
      return;
    }
    setCreatingSample(true);
    createRepo.mutate(
      { name: "sample-repo", default_branch: "main", is_sample: true },
      {
        onSuccess: (repo) => startAnalysis(repo.id),
        onSettled: () => setCreatingSample(false),
      }
    );
  };

  const deleteRepo = useMutation({
    mutationFn: api.deleteRepository,
    onSuccess: () => {
      setConfirmDelete(null);
      qc.invalidateQueries({ queryKey: ["repos"] });
      qc.invalidateQueries({ queryKey: ["analyses"] });
      toast.success("Repository deleted");
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : "Failed to delete repository";
      toast.error(msg);
    },
  });

  const handleDelete = (repo: Repository) => {
    setConfirmDelete(repo);
  };

  const confirmRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirmDelete) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !deleteRepo.isPending) setConfirmDelete(null);
    };
    document.addEventListener("keydown", onKey);
    cancelRef.current?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmDelete, deleteRepo.isPending]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <PageHeader
        title="Repositories"
        description="Connect a repository or run the built-in sample"
      >
        <Button
          variant="outline"
          size="sm"
          data-guide="try-sample"
          onClick={handleSample}
          disabled={creatingSample || runAnalysis.isPending || !!sampleActive}
        >
          {creatingSample || (runAnalysis.isPending && analyzingId !== null) ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : sampleActive ? (
            <Eye className="mr-1 h-4 w-4" />
          ) : (
            <Rocket className="mr-1 h-4 w-4" />
          )}
          {sampleActive ? "View Sample Findings" : "TRY SAMPLE REPOSITORY"}
        </Button>
      </PageHeader>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.35 }}
      >
        <Card className="mb-6" data-guide="connect-form">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Plus className="h-4 w-4" />
              Connect a repository
            </CardTitle>
            <CardDescription>
              Paste a Git URL to clone for analysis (no credentials required for
              public repos).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="flex flex-wrap items-end gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!name.trim()) return;
                setError(null);
                createRepo.mutate({
                  name: name.trim(),
                  url: url.trim() || undefined,
                  default_branch: branch.trim() || "main",
                });
              }}
            >
              <div className="min-w-[180px] flex-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Name
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="my-project"
                  required
                />
              </div>
              <div className="min-w-[240px] flex-[2]">
                <label className="text-xs font-medium text-muted-foreground">
                  Git URL{" "}
                  <span className="text-muted-foreground/60">(optional)</span>
                </label>
                <Input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://github.com/org/repo.git"
                />
              </div>
              <div className="w-28">
                <label className="text-xs font-medium text-muted-foreground">
                  Branch
                </label>
                <Input
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={createRepo.isPending || !name.trim()}>
                {createRepo.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GitBranch className="h-4 w-4" />
                )}
                Add
              </Button>
            </form>
            {error && (
              <p className="mt-3 text-sm text-destructive">{error}</p>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {repos.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-5">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="mt-3 h-3 w-full" />
                <div className="mt-3 flex gap-3">
                  <Skeleton className="h-3 w-14" />
                  <Skeleton className="h-3 w-14" />
                </div>
                <Skeleton className="mt-4 h-8 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (repos.data ?? []).length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
        >
          <Card>
            <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
              <Boxes className="h-10 w-10 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No repositories yet. Add one above, or try the sample to see the
                system in action instantly.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      ) : (
        <motion.div
          className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          variants={staggerContainer}
          initial="hidden"
          animate="show"
        >
          {(repos.data ?? []).map((repo) => (
            <motion.div key={repo.id} variants={fadeUpItem}>
              <Card className="group hover:border-primary/30">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <FolderGit2 className="h-5 w-5 text-primary transition-transform duration-300 group-hover:scale-110" />
                      <span className="font-medium">{repo.name}</span>
                    </div>
                    {repo.is_sample && <Badge variant="secondary">sample</Badge>}
                  </div>
                  {repo.url && (
                    <p className="mt-2 flex items-center gap-1 truncate text-xs text-muted-foreground">
                      <Copy className="h-3 w-3" />
                      {repo.url}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span>{formatBytes(repo.size_bytes)}</span>
                    <span>{repo.file_count} files</span>
                    <span>{repo.default_branch}</span>
                    <span>{relativeTime(repo.created_at)}</span>
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startAnalysis(repo.id)}
                      disabled={analyzingId === repo.id || !!activeAnalysisByRepo.get(repo.id)}
                    >
                      {analyzingId === repo.id || !!activeAnalysisByRepo.get(repo.id) ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : null}
                      {activeAnalysisByRepo.get(repo.id) ? "Analyzing…" : "Analyze"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="ml-auto"
                      onClick={() => handleDelete(repo)}
                      aria-label={`Delete repository ${repo.name}`}
                      title="Delete repository"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}

      {confirmDelete && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !deleteRepo.isPending && setConfirmDelete(null)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <div
            ref={confirmRef}
            className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              id="delete-dialog-title"
              className="flex items-center gap-2 text-base font-medium"
            >
              <Trash2 className="h-5 w-5 text-destructive" />
              Delete repository?
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              This permanently removes{" "}
              <span className="font-medium text-foreground">{confirmDelete.name}</span>{" "}
              and all of its analyses and findings. This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                ref={cancelRef}
                variant="outline"
                size="sm"
                onClick={() => setConfirmDelete(null)}
                disabled={deleteRepo.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteRepo.mutate(confirmDelete.id)}
                disabled={deleteRepo.isPending}
              >
                {deleteRepo.isPending ? (
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                ) : null}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

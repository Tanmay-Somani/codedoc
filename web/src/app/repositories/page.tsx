"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
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
import type { Repository } from "@/lib/types";

export default function RepositoriesPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [branch, setBranch] = useState("main");
  const [error, setError] = useState<string | null>(null);
  const [analyzingId, setAnalyzingId] = useState<number | null>(null);

  const repos = useQuery({ queryKey: ["repos"], queryFn: api.repositories });
  const analyses = useQuery({
    queryKey: ["analyses"],
    queryFn: api.analyses,
    refetchInterval: 5000,
  });

  const activeByRepo = useMemo(() => {
    const m = new Map<number, boolean>();
    for (const a of analyses.data ?? []) {
      if (a.status === "queued" || a.status === "running") {
        m.set(a.repository_id, true);
      }
    }
    return m;
  }, [analyses.data]);

  const sampleRepo = (repos.data ?? []).find((r) => r.is_sample);
  const sampleActive = sampleRepo ? activeByRepo.get(sampleRepo.id) : false;

  const createRepo = useMutation({
    mutationFn: api.createRepository,
    onSuccess: () => {
      setName("");
      setUrl("");
      setError(null);
      qc.invalidateQueries({ queryKey: ["repos"] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to add repository");
    },
  });

  const runAnalysis = useMutation({
    mutationFn: api.createAnalysis,
    onSuccess: (analysis) => {
      qc.invalidateQueries({ queryKey: ["analyses"] });
      router.push("/findings");
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "Failed to start analysis");
    },
  });

  const startAnalysis = (repositoryId: number) => {
    if (activeByRepo.get(repositoryId)) {
      router.push("/findings");
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
      router.push("/findings");
      return;
    }
    if (sampleRepo) {
      startAnalysis(sampleRepo.id);
      return;
    }
    createRepo.mutate(
      { name: "sample-repo", default_branch: "main", is_sample: true },
      { onSuccess: (repo) => startAnalysis(repo.id) }
    );
  };

  const handleDelete = async (repo: Repository) => {
    setError("Deleting repositories is not wired to the backend yet.");
  };

  return (
    <div>
      <PageHeader
        title="Repositories"
        description="Connect a repository or run the built-in sample"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={handleSample}
          disabled={createRepo.isPending || runAnalysis.isPending}
        >
          {(createRepo.isPending || runAnalysis.isPending) && analyzingId === null ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : sampleActive ? (
            <Eye className="mr-1 h-4 w-4" />
          ) : (
            <Rocket className="mr-1 h-4 w-4" />
          )}
          {sampleActive ? "View Sample Findings" : "TRY SAMPLE REPOSITORY"}
        </Button>
      </PageHeader>

      <Card className="mb-6">
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
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <Boxes className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No repositories yet. Add one above, or try the sample to see the
              system in action instantly.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(repos.data ?? []).map((repo) => (
            <Card key={repo.id}>
              <CardContent className="pt-5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <FolderGit2 className="h-5 w-5 text-primary" />
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
                    disabled={analyzingId === repo.id || activeByRepo.get(repo.id)}
                  >
                    {analyzingId === repo.id || activeByRepo.get(repo.id) ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : null}
                    {activeByRepo.get(repo.id) ? "Analyzing…" : "Analyze"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto"
                    onClick={() => handleDelete(repo)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
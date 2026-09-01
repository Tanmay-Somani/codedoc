"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Boxes,
  Copy,
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

export default function RepositoriesPage() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [branch, setBranch] = useState("main");

  const repos = useQuery({ queryKey: ["repos"], queryFn: api.repositories });

  const createRepo = useMutation({
    mutationFn: (data: { name: string; url?: string; default_branch?: string }) =>
      api.createRepository(data),
    onSuccess: () => {
      setName("");
      setUrl("");
      qc.invalidateQueries({ queryKey: ["repos"] });
    },
  });

  const handleSample = () => {
    createRepo.mutate({ name: "sample-repo", url: undefined, default_branch: "main" });
  };

  return (
    <div>
      <PageHeader
        title="Repositories"
        description="Connect a repository or run the built-in sample"
      >
        <Button variant="outline" size="sm" onClick={handleSample}>
          <Rocket className="mr-1 h-4 w-4" />
          TRY SAMPLE REPOSITORY
        </Button>
      </PageHeader>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Plus className="h-4 w-4" />
            Connect a repository
          </CardTitle>
          <CardDescription>
            Paste a Git URL to clone for analysis (no credentials required for public repos).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="flex flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim()) createRepo.mutate({ name: name.trim() });
            }}
          >
            <div className="min-w-[180px] flex-1">
              <label className="text-xs font-medium text-muted-foreground">Name</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-project"
                required
              />
            </div>
            <div className="min-w-[240px] flex-[2]">
              <label className="text-xs font-medium text-muted-foreground">
                Git URL <span className="text-muted-foreground/60">(optional)</span>
              </label>
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://github.com/org/repo.git"
              />
            </div>
            <div className="w-28">
              <label className="text-xs font-medium text-muted-foreground">Branch</label>
              <Input value={branch} onChange={(e) => setBranch(e.target.value)} />
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
                  <Button size="sm" variant="outline">
                    Analyze
                  </Button>
                  <Button size="sm" variant="ghost" className="ml-auto">
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

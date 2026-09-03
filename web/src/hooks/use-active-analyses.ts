import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Analysis } from "@/lib/types";

const isActive = (a: Analysis) => a.status === "queued" || a.status === "running";

export function hasActiveAnalysis(analyses: Analysis[] | undefined): boolean {
  return (analyses ?? []).some(isActive);
}

export function useActiveAnalyses() {
  const analyses = useQuery({
    queryKey: ["analyses"],
    queryFn: api.analyses,
    refetchInterval: (query) => {
      const data = query.state.data as Analysis[] | undefined;
      return hasActiveAnalysis(data) ? 5000 : false;
    },
  });

  const active = (analyses.data ?? []).filter(isActive);

  return { analyses, active };
}

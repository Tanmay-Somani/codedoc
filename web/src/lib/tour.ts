const TOUR_DONE_KEY = "codedoc_tour_done";
const VISITED_REPOS_KEY = "codedoc_visited_repos";

export function markTourDone() {
  try {
    localStorage.setItem(TOUR_DONE_KEY, "1");
  } catch {
    /* storage unavailable — tour just replays */
  }
}

export function tourDone(): boolean {
  try {
    return localStorage.getItem(TOUR_DONE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markReposVisited() {
  try {
    localStorage.setItem(VISITED_REPOS_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function reposVisited(): boolean {
  try {
    return localStorage.getItem(VISITED_REPOS_KEY) === "1";
  } catch {
    return false;
  }
}

export function resetTour() {
  try {
    localStorage.removeItem(TOUR_DONE_KEY);
    localStorage.removeItem(VISITED_REPOS_KEY);
  } catch {
    /* ignore */
  }
}
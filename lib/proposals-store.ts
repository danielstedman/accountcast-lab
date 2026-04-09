// Proposals state storage
// Currently uses localStorage. When Vercel KV is set up,
// swap to KV by changing the load/save functions below.

export interface ProposalsState {
  order: string[];
  statuses: Record<string, "approved" | "postponed" | "cancelled" | null>;
  dates: Record<string, string>;
}

const STORAGE_KEY = "accountcast-proposals-state";

export function loadProposalsState(): ProposalsState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function saveProposalsState(state: ProposalsState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // silently fail
  }
}

export interface ProposalsState {
  order: string[];
  statuses: Record<string, "approved" | "postponed" | "cancelled" | null>;
  dates: Record<string, string>;
}

export async function loadProposalsState(): Promise<ProposalsState | null> {
  try {
    const res = await fetch("/api/proposals");
    if (!res.ok) return loadFromLocalStorage();
    const data = await res.json();
    return data || loadFromLocalStorage();
  } catch {
    return loadFromLocalStorage();
  }
}

export async function saveProposalsState(state: ProposalsState): Promise<void> {
  // Save to both Redis and localStorage
  saveToLocalStorage(state);
  try {
    await fetch("/api/proposals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(state),
    });
  } catch {
    // Silently fall back to localStorage only
  }
}

// localStorage fallback
const STORAGE_KEY = "accountcast-proposals-state";

function loadFromLocalStorage(): ProposalsState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveToLocalStorage(state: ProposalsState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // silently fail
  }
}

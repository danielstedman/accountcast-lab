export type Status = "active" | "paused" | "planned";
export type Confidence = "high" | "medium" | "low";
export type Motion = "sales" | "marketing" | "product";

export interface DetailRow {
  label: string;
  value: number | string;
  rate?: string;
}

export interface ProposedExperiment {
  id: string;
  name: string;
  channel: string;
  motion: Motion;
  hypothesis: string;
  ctaTested: string;
  durationWeeks: number;
  successCriteria: string;
  defaultScore: number;
  startDate: string;
}
}

export interface Campaign {
  id: string;
  name: string;
  channel: string;
  mode: string;     // "LinkedIn", "Email", "Multithread", or "" for non-applicable
  motion: Motion;   // "sales", "marketing", or "product"
  status: Status;
  dateRange: string;
  // Unified top-level metrics
  targeted: number | "n/a" | null; // people we aimed at, or n/a for inbound channels
  reached: number | null;     // people who engaged (opens, accepts, page views)
  replies: number | "n/a" | null; // replies (email/LinkedIn) or n/a if not applicable
  conversion: string | null;  // conversion rate (e.g. CTA click rate, reply-to-meeting rate)
  meetings: number;           // bottom of funnel
  // PMF
  pmfScore: number | null;    // 0-100, null if not enough data
  pmfNote: string;
  // Confidence
  confidence: Confidence;
  confidenceNote: string;
  // Detail rows for expanded view
  details: DetailRow[];
  notes: string;
}

"use client";

import { useState, useMemo } from "react";
import { CAMPAIGNS, PROPOSED_EXPERIMENTS } from "@/lib/seed-data";
import { Campaign, Confidence, Motion, ProposedExperiment } from "@/lib/types";

type SortKey = "name" | "targeted" | "reached" | "replies" | "conversion" | "meetings" | "pmfScore" | "confidence";
type SortDir = "asc" | "desc";
type Tab = "dashboard" | "lab";

const CONFIDENCE_ORDER: Record<Confidence, number> = { high: 3, medium: 2, low: 1 };

const MOTION_CONFIG: Record<Motion, { label: string; color: string; bg: string }> = {
  sales: { label: "Sales-led", color: "text-blue-700", bg: "bg-blue-50 border-blue-200" },
  marketing: { label: "Marketing-led", color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  product: { label: "Product-led", color: "text-teal-700", bg: "bg-teal-50 border-teal-200" },
};

function parsePercent(s: string | null): number {
  if (!s) return -1;
  const n = parseFloat(s);
  return isNaN(n) ? -1 : n;
}

function repliesSortVal(v: number | "n/a" | null): number {
  if (v === "n/a" || v === null) return -1;
  return v;
}

function num(v: number | "n/a" | null) {
  if (v === "n/a") return <span className="text-zinc-400 text-xs">N/A</span>;
  if (v === null) return <span className="text-zinc-300">{"\u2014"}</span>;
  return v.toLocaleString();
}

function MotionBadge({ motion }: { motion: Motion }) {
  const m = MOTION_CONFIG[motion];
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium border ${m.bg} ${m.color}`}>
      {m.label}
    </span>
  );
}

function PmfBadge({ score, note }: { score: number | null; note: string }) {
  if (score === null)
    return (
      <span className="text-zinc-300" title={note}>
        {"\u2014"}
      </span>
    );
  const color =
    score >= 80
      ? "bg-emerald-100 text-emerald-800"
      : score > 0
      ? "bg-amber-100 text-amber-800"
      : "bg-red-100 text-red-800";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${color}`} title={note}>
      {score}%
    </span>
  );
}

function ConfidenceDot({ level, note }: { level: Confidence; note: string }) {
  const config = {
    high: { color: "bg-emerald-500", label: "High" },
    medium: { color: "bg-amber-400", label: "Med" },
    low: { color: "bg-zinc-300", label: "Low" },
  };
  const c = config[level];
  return (
    <span className="inline-flex items-center gap-1.5" title={note}>
      <span className={`w-2 h-2 rounded-full ${c.color}`} />
      <span className="text-xs text-muted">{c.label}</span>
    </span>
  );
}

function StatusDot({ status }: { status: Campaign["status"] }) {
  const config = {
    active: { color: "bg-emerald-500 animate-pulse", label: "Active" },
    paused: { color: "bg-amber-400", label: "Paused" },
    planned: { color: "bg-zinc-300", label: "Planned" },
  };
  const c = config[status];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-1.5 h-1.5 rounded-full ${c.color}`} />
      <span className="text-xs text-muted">{c.label}</span>
    </span>
  );
}

function RepliesCell({ value }: { value: number | "n/a" | null }) {
  if (value === "n/a") return <span className="text-zinc-400 text-xs">N/A</span>;
  if (value === null) return <span className="text-zinc-300">{"\u2014"}</span>;
  return <>{value.toLocaleString()}</>;
}

function ConversionCell({ value }: { value: string | null }) {
  if (value === null) return <span className="text-zinc-300">{"\u2014"}</span>;
  if (value === "0%") return <span className="text-red-500">{value}</span>;
  if (value === "100%") return <span className="text-emerald-600 font-semibold">{value}</span>;
  return <>{value}</>;
}

function CampaignRow({ campaign }: { campaign: Campaign }) {
  const [open, setOpen] = useState(false);
  const c = campaign;

  return (
    <>
      <tr
        onClick={() => setOpen(!open)}
        className={`border-b border-border hover:bg-zinc-50 cursor-pointer transition-colors ${open ? "bg-zinc-50" : ""}`}
      >
        <td className="py-3 px-4">
          <span className="text-zinc-400 text-sm">{open ? "\u25BE" : "\u25B8"}</span>
        </td>
        <td className="py-3 pr-4">
          <div className="flex items-center gap-2">
            <div className="font-medium text-sm text-foreground">{c.name}</div>
            <StatusDot status={c.status} />
            <MotionBadge motion={c.motion} />
          </div>
          <div className="text-xs text-muted">{c.channel}{c.mode ? ` \u00B7 ${c.mode}` : ""} \u00B7 {c.dateRange}</div>
        </td>
        <td className="py-3 pr-4 text-sm font-mono text-right">{num(c.targeted)}</td>
        <td className="py-3 pr-4 text-sm font-mono text-right">{num(c.reached)}</td>
        <td className="py-3 pr-4 text-sm font-mono text-right">
          <RepliesCell value={c.replies} />
        </td>
        <td className="py-3 pr-4 text-sm font-mono text-right">
          <ConversionCell value={c.conversion} />
        </td>
        <td className="py-3 pr-4 text-sm font-mono text-right">
          {c.meetings > 0 ? (
            <span className="font-semibold">{c.meetings}</span>
          ) : (
            <span className="text-zinc-300">0</span>
          )}
        </td>
        <td className="py-3 pr-4 text-center">
          <PmfBadge score={c.pmfScore} note={c.pmfNote} />
        </td>
        <td className="py-3 pr-4">
          <ConfidenceDot level={c.confidence} note={c.confidenceNote} />
        </td>
      </tr>
      {open && (
        <tr className="border-b border-border bg-zinc-50">
          <td></td>
          <td colSpan={8} className="py-3 pr-6">
            {c.details.length > 0 && (
              <div className="max-w-md mb-2">
                {c.details.map((d) => (
                  <div
                    key={d.label}
                    className="flex items-center justify-between text-xs py-1 border-b border-zinc-200/60 last:border-0"
                  >
                    <span className="text-muted">{d.label}</span>
                    <span className="font-mono text-foreground">
                      {typeof d.value === "number"
                        ? d.value.toLocaleString()
                        : d.value}
                      {d.rate && (
                        <span className="text-muted ml-1.5">({d.rate})</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-zinc-400">
              {[c.notes, c.pmfNote, c.confidenceNote]
                .filter(Boolean)
                .join(" \u00B7 ")}
            </p>
          </td>
        </tr>
      )}
    </>
  );
}

function SortIcon({ column, current, dir }: { column: SortKey; current: SortKey | null; dir: SortDir }) {
  if (current !== column) return <span className="text-zinc-300 ml-1">{"\u2195"}</span>;
  return <span className="text-accent ml-1">{dir === "asc" ? "\u2191" : "\u2193"}</span>;
}

function ProposalRow({ proposal }: { proposal: ProposedExperiment }) {
  const p = proposal;
  const [open, setOpen] = useState(false);

  return (
    <>
      <tr
        onClick={() => setOpen(!open)}
        className={`border-b border-border hover:bg-zinc-50 cursor-pointer transition-colors ${open ? "bg-zinc-50" : ""}`}
      >
        <td className="py-3 px-4">
          <span className="text-zinc-400 text-sm">{open ? "\u25BE" : "\u25B8"}</span>
        </td>
        <td className="py-3 pr-4">
          <div className="flex items-center gap-2">
            <div className="font-medium text-sm text-foreground">{p.name}</div>
            <MotionBadge motion={p.motion} />
          </div>
          <div className="text-xs text-muted">{p.channel} \u00B7 {p.durationWeeks} week{p.durationWeeks > 1 ? "s" : ""}</div>
        </td>
        <td className="py-3 pr-4 text-sm text-muted" colSpan={2}>
          {p.ctaTested}
        </td>
        <td className="py-3 pr-4 text-sm text-muted" colSpan={4}>
          {p.successCriteria}
        </td>
      </tr>
      {open && (
        <tr className="border-b border-border bg-zinc-50">
          <td></td>
          <td colSpan={7} className="py-3 pr-6">
            <div className="space-y-2">
              <div>
                <span className="text-xs font-medium text-muted uppercase tracking-wider">Hypothesis</span>
                <p className="text-sm text-zinc-600 mt-0.5">{p.hypothesis}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted uppercase tracking-wider">Success criteria</span>
                <p className="text-sm text-zinc-600 mt-0.5">{p.successCriteria}</p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return CAMPAIGNS;
    return [...CAMPAIGNS].sort((a, b) => {
      let aVal: number;
      let bVal: number;
      if (sortKey === "name") {
        const cmp = a.name.localeCompare(b.name);
        return sortDir === "asc" ? cmp : -cmp;
      } else if (sortKey === "confidence") {
        aVal = CONFIDENCE_ORDER[a.confidence];
        bVal = CONFIDENCE_ORDER[b.confidence];
      } else if (sortKey === "replies") {
        aVal = repliesSortVal(a.replies);
        bVal = repliesSortVal(b.replies);
      } else if (sortKey === "conversion") {
        aVal = parsePercent(a.conversion);
        bVal = parsePercent(b.conversion);
      } else if (sortKey === "targeted") {
        aVal = typeof a.targeted === "number" ? a.targeted : -1;
        bVal = typeof b.targeted === "number" ? b.targeted : -1;
      } else {
        aVal = a[sortKey] ?? -1;
        bVal = b[sortKey] ?? -1;
      }
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [sortKey, sortDir]);

  const totalMeetings = CAMPAIGNS.reduce((a, c) => a + c.meetings, 0);
  const withPmf = CAMPAIGNS.filter((c) => c.pmfScore !== null && c.pmfScore > 0);
  const bestPmf = withPmf.length > 0 ? Math.max(...withPmf.map((c) => c.pmfScore!)) : null;

  const columns: { key: SortKey; label: string; align: string }[] = [
    { key: "name", label: "Campaign", align: "text-left" },
    { key: "targeted", label: "Targeted", align: "text-right" },
    { key: "reached", label: "Reached", align: "text-right" },
    { key: "replies", label: "Replies", align: "text-right" },
    { key: "conversion", label: "Conversion", align: "text-right" },
    { key: "meetings", label: "Meetings", align: "text-right" },
    { key: "pmfScore", label: "PMF", align: "text-center" },
    { key: "confidence", label: "Confidence", align: "text-left" },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-5 flex items-end justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Account<span className="text-accent">Cast</span>
              <span className="text-muted font-normal ml-1.5">Lab</span>
            </h1>
            <p className="text-sm text-muted mt-0.5">
              Growth experiments {"\u2014"} at a glance
            </p>
          </div>
          <div className="text-xs text-muted">
            Updated Apr 8, 2026
          </div>
        </div>
        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-6 flex gap-1">
          <button
            onClick={() => setTab("dashboard")}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tab === "dashboard"
                ? "bg-white text-foreground border border-border border-b-white -mb-px"
                : "text-muted hover:text-foreground"
            }`}
          >
            Dashboard
            <span className="ml-1.5 text-xs bg-zinc-100 text-muted px-1.5 py-0.5 rounded-full">
              {CAMPAIGNS.length}
            </span>
          </button>
          <button
            onClick={() => setTab("lab")}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              tab === "lab"
                ? "bg-white text-foreground border border-border border-b-white -mb-px"
                : "text-muted hover:text-foreground"
            }`}
          >
            Lab
            <span className="ml-1.5 text-xs bg-zinc-100 text-muted px-1.5 py-0.5 rounded-full">
              {PROPOSED_EXPERIMENTS.length}
            </span>
          </button>
        </div>
      </header>

      {tab === "dashboard" && (
        <>
          {/* Summary cards */}
          <div className="max-w-6xl mx-auto px-6 py-5">
            <div className="grid grid-cols-4 gap-4">
              <div className="border border-border rounded-lg px-4 py-3">
                <div className="text-xs text-muted uppercase tracking-wide">Campaigns</div>
                <div className="text-2xl font-bold font-mono mt-0.5">{CAMPAIGNS.length}</div>
                <div className="text-xs text-muted">
                  {CAMPAIGNS.filter((c) => c.status === "active").length} active \u00B7 {CAMPAIGNS.filter((c) => c.status === "planned").length} planned
                </div>
              </div>
              <div className="border border-border rounded-lg px-4 py-3">
                <div className="text-xs text-muted uppercase tracking-wide">Total targeted</div>
                <div className="text-2xl font-bold font-mono mt-0.5">
                  {CAMPAIGNS.reduce((a, c) => a + (typeof c.targeted === "number" ? c.targeted : 0), 0).toLocaleString()}
                </div>
                <div className="text-xs text-muted">across all channels</div>
              </div>
              <div className="border border-border rounded-lg px-4 py-3">
                <div className="text-xs text-muted uppercase tracking-wide">Meetings booked</div>
                <div className="text-2xl font-bold font-mono mt-0.5">{totalMeetings}</div>
                <div className="text-xs text-muted">all founder-led so far</div>
              </div>
              <div className="border border-border rounded-lg px-4 py-3">
                <div className="text-xs text-muted uppercase tracking-wide">Best PMF signal</div>
                <div className="text-2xl font-bold font-mono mt-0.5">
                  {bestPmf !== null ? `${bestPmf}%` : "\u2014"}
                </div>
                <div className="text-xs text-muted">
                  {bestPmf !== null && bestPmf >= 80 ? "above 80% target" : "target: 80%"}
                </div>
              </div>
            </div>

            {/* Motion legend */}
            <div className="flex items-center gap-4 mt-3 text-xs text-muted">
              <span className="font-medium text-foreground">Motions:</span>
              {(Object.entries(MOTION_CONFIG) as [Motion, typeof MOTION_CONFIG.sales][]).map(([key, val]) => (
                <span key={key} className="flex items-center gap-1">
                  <MotionBadge motion={key} />
                </span>
              ))}
            </div>
          </div>

          {/* Dashboard table */}
          <div className="max-w-6xl mx-auto px-6 pb-12">
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-zinc-50 border-b border-border text-xs text-muted uppercase tracking-wider">
                    <th className="w-8 py-2.5 px-4"></th>
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className={`py-2.5 pr-4 ${col.align} font-medium cursor-pointer hover:text-foreground transition-colors select-none`}
                      >
                        {col.label}
                        <SortIcon column={col.key} current={sortKey} dir={sortDir} />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c) => (
                    <CampaignRow key={c.id} campaign={c} />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-zinc-400 mt-3">
              Click column headers to sort. Click any row to expand details. PMF target is 80% (Danner framework).
            </p>
          </div>
        </>
      )}

      {tab === "lab" && (
        <div className="max-w-6xl mx-auto px-6 py-6 pb-12">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground">Experiment Lab</h2>
            <p className="text-sm text-muted mt-1">
              Proposed experiments to test. Activate one to move it to the Dashboard and start measuring PMF.
            </p>
          </div>

          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-50 border-b border-border text-xs text-muted uppercase tracking-wider">
                  <th className="w-8 py-2.5 px-4"></th>
                  <th className="py-2.5 pr-4 text-left font-medium">Experiment</th>
                  <th className="py-2.5 pr-4 text-left font-medium" colSpan={2}>CTA to test</th>
                  <th className="py-2.5 pr-4 text-left font-medium" colSpan={4}>Success criteria</th>
                </tr>
              </thead>
              <tbody>
                {PROPOSED_EXPERIMENTS.map((p) => (
                  <ProposalRow key={p.id} proposal={p} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-zinc-400 mt-3">
            Click any row to see the full hypothesis. Based on Danner{"'"}s PMF framework: find the magic, run 5 experiments/week, stay focused.
          </p>
        </div>
      )}
    </div>
  );
}

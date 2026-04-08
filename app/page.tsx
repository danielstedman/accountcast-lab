"use client";

import { useState, useMemo, useEffect } from "react";
import { CAMPAIGNS, PROPOSED_EXPERIMENTS } from "@/lib/seed-data";
import { Campaign, Confidence, Motion, ProposedExperiment } from "@/lib/types";

interface PipelineStage {
  id: number;
  name: string;
  count: number;
  value: number;
  deals: { id: number; title: string; org_name: string | null; value: number }[];
}

interface PipelineData {
  totalDeals: number;
  totalValue: number;
  stages: PipelineStage[];
}

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
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-medium text-sm text-foreground truncate max-w-[140px] lg:max-w-none">{c.name}</div>
            <StatusDot status={c.status} />
            <span className="hidden sm:inline"><MotionBadge motion={c.motion} /></span>
          </div>
          <div className="text-xs text-muted truncate max-w-[140px] lg:max-w-none">{c.channel}{c.mode ? ` \u00B7 ${c.mode}` : ""} \u00B7 {c.dateRange}</div>
        </td>
        <td className="py-3 pr-4 text-sm font-mono text-right hidden lg:table-cell">{num(c.targeted)}</td>
        <td className="py-3 pr-4 text-sm font-mono text-right">{num(c.reached)}</td>
        <td className="py-3 pr-4 text-sm font-mono text-right hidden lg:table-cell">
          <RepliesCell value={c.replies} />
        </td>
        <td className="py-3 pr-4 text-sm font-mono text-right hidden lg:table-cell">
          <ConversionCell value={c.conversion} />
        </td>
        <td className="py-3 pr-4 text-sm font-mono text-right hidden lg:table-cell">
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
              <div className="max-w-full lg:max-w-md mb-2">
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

function ProposalRow({ proposal, onDateChange }: { proposal: ProposedExperiment; onDateChange: (id: string, date: string) => void }) {
  const p = proposal;
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState(p.defaultScore);

  return (
    <>
      <tr
        className={`border-b border-border hover:bg-zinc-50 transition-colors ${open ? "bg-zinc-50" : ""}`}
      >
        <td className="py-3 px-4 cursor-pointer" onClick={() => setOpen(!open)}>
          <span className="text-zinc-400 text-sm">{open ? "\u25BE" : "\u25B8"}</span>
        </td>
        <td className="py-3 pr-4 cursor-pointer" onClick={() => setOpen(!open)}>
          <div className="flex items-center gap-2">
            <div className="font-medium text-sm text-foreground">{p.name}</div>
            <MotionBadge motion={p.motion} />
          </div>
          <div className="text-xs text-muted">{p.channel} \u00B7 {p.durationWeeks} week{p.durationWeeks > 1 ? "s" : ""}</div>
        </td>
        <td className="py-3 pr-4 text-sm text-muted cursor-pointer hidden lg:table-cell" colSpan={2} onClick={() => setOpen(!open)}>
          {p.ctaTested}
        </td>
        <td className="py-3 pr-4 hidden lg:table-cell" colSpan={2}>
          <input
            type="date"
            value={p.startDate}
            onChange={(e) => onDateChange(p.id, e.target.value)}
            className={`text-sm border border-border rounded-md px-2 py-1 bg-white cursor-pointer ${
              p.startDate ? "text-foreground" : "text-zinc-400"
            }`}
          />
        </td>
        <td className="py-3 pr-4">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setScore(score - 1)}
              className="px-1.5 py-1 rounded hover:bg-red-50 transition-colors text-sm"
              title="Vote down"
            >
              {"\uD83D\uDC4E"}
            </button>
            <span className={`text-sm font-mono font-semibold min-w-[2ch] text-center ${
              score > 0 ? "text-emerald-600" : score < 0 ? "text-red-500" : "text-zinc-400"
            }`}>
              {score > 0 ? `+${score}` : score}
            </span>
            <button
              onClick={() => setScore(score + 1)}
              className="px-1.5 py-1 rounded hover:bg-emerald-50 transition-colors text-sm"
              title="Vote up"
            >
              {"\uD83D\uDC4D"}
            </button>
          </div>
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

function AddExperimentForm({ onAdd }: { onAdd: (p: ProposedExperiment) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("");
  const [motion, setMotion] = useState<Motion>("sales");
  const [hypothesis, setHypothesis] = useState("");
  const [cta, setCta] = useState("");
  const [weeks, setWeeks] = useState(2);
  const [criteria, setCriteria] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onAdd({
      id: `prop-${Date.now()}`,
      name: name.trim(),
      channel: channel.trim() || "TBD",
      motion,
      hypothesis: hypothesis.trim(),
      ctaTested: cta.trim(),
      durationWeeks: weeks,
      successCriteria: criteria.trim(),
      defaultScore: 0,
      startDate: "",
    });
    setName("");
    setChannel("");
    setMotion("sales");
    setHypothesis("");
    setCta("");
    setWeeks(2);
    setCriteria("");
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-4 px-4 py-2.5 text-sm font-medium text-accent border border-dashed border-accent/40 rounded-lg hover:bg-accent/5 transition-colors w-full"
      >
        + Add a new experiment idea
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-4 border border-border rounded-xl p-5 bg-zinc-50">
      <h3 className="text-sm font-semibold text-foreground mb-3">New experiment idea</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-muted mb-1">Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-border rounded-md bg-white"
            placeholder="e.g. LinkedIn Ads — Retargeting"
            required
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Channel</label>
          <input
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-border rounded-md bg-white"
            placeholder="e.g. Dripify, Lemlist, LinkedIn"
          />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Motion</label>
          <select
            value={motion}
            onChange={(e) => setMotion(e.target.value as Motion)}
            className="w-full px-3 py-1.5 text-sm border border-border rounded-md bg-white"
          >
            <option value="sales">Sales-led</option>
            <option value="marketing">Marketing-led</option>
            <option value="product">Product-led</option>
          </select>
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Duration (weeks)</label>
          <input
            type="number"
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
            className="w-full px-3 py-1.5 text-sm border border-border rounded-md bg-white"
            min={1}
            max={12}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-muted mb-1">CTA to test</label>
          <input
            value={cta}
            onChange={(e) => setCta(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-border rounded-md bg-white"
            placeholder="e.g. Free Target Account List with intent data"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-muted mb-1">Hypothesis</label>
          <textarea
            value={hypothesis}
            onChange={(e) => setHypothesis(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-border rounded-md bg-white"
            rows={2}
            placeholder="What do you think will happen and why?"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs text-muted mb-1">Success criteria</label>
          <input
            value={criteria}
            onChange={(e) => setCriteria(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-border rounded-md bg-white"
            placeholder="e.g. 15%+ reply rate, 3+ meetings in 2 weeks"
          />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        <button
          type="submit"
          className="px-4 py-1.5 text-sm font-medium bg-accent text-white rounded-md hover:bg-accent-light transition-colors"
        >
          Add experiment
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-4 py-1.5 text-sm font-medium text-muted hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [proposals, setProposals] = useState(PROPOSED_EXPERIMENTS);
  const [pipeline, setPipeline] = useState<PipelineData | null>(null);

  useEffect(() => {
    fetch("/api/pipeline")
      .then((r) => r.json())
      .then((data) => setPipeline(data))
      .catch(() => {});
  }, []);

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

  const columns: { key: SortKey; label: string; align: string; hideOnMobile?: boolean }[] = [
    { key: "name", label: "Campaign", align: "text-left" },
    { key: "targeted", label: "Targeted", align: "text-right", hideOnMobile: true },
    { key: "reached", label: "Reached", align: "text-right" },
    { key: "replies", label: "Replies", align: "text-right", hideOnMobile: true },
    { key: "conversion", label: "Conversion", align: "text-right", hideOnMobile: true },
    { key: "meetings", label: "Meetings", align: "text-right", hideOnMobile: true },
    { key: "pmfScore", label: "PMF", align: "text-center" },
    { key: "confidence", label: "Data Quality", align: "text-left" },
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 lg:px-6 py-4 lg:py-5 flex flex-col sm:flex-row sm:items-end justify-between gap-1">
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
        <div className="max-w-6xl mx-auto px-4 lg:px-6 flex gap-1 overflow-x-auto">
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
            Proposed PMF Experiments
            <span className="ml-1.5 text-xs bg-zinc-100 text-muted px-1.5 py-0.5 rounded-full">
              {proposals.length}
            </span>
          </button>
        </div>
      </header>

      {tab === "dashboard" && (
        <>
          {/* Pipeline summary */}
          {pipeline && (
            <div className="max-w-6xl mx-auto px-4 lg:px-6 pt-4 lg:pt-5">
              <div className="text-xs font-medium text-muted uppercase tracking-wider mb-2">AccountCast Pipeline (Pipedrive)</div>
              <div className="grid grid-cols-4 gap-2 lg:gap-3">
                {pipeline.stages.map((stage) => {
                  const isActive = stage.count > 0;
                  const isWon = stage.name === "Closed/Won";
                  return (
                    <div
                      key={stage.id}
                      className={`rounded-lg px-3 py-2.5 border ${
                        isWon && isActive
                          ? "border-emerald-300 bg-emerald-50"
                          : isActive
                          ? "border-accent/30 bg-accent/5"
                          : "border-border bg-white"
                      }`}
                    >
                      <div className={`text-[10px] uppercase tracking-wider truncate ${isWon ? "text-emerald-600 font-semibold" : "text-muted"}`}>
                        {stage.name}
                      </div>
                      <div className={`text-lg font-bold font-mono ${
                        isWon && isActive ? "text-emerald-700" : isActive ? "text-foreground" : "text-zinc-300"
                      }`}>
                        {stage.count}
                      </div>
                      {stage.value > 0 && (
                        <div className={`text-xs font-mono ${isWon ? "text-emerald-600" : "text-accent"}`}>
                          ${stage.value.toLocaleString()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Summary cards */}
          <div className="max-w-6xl mx-auto px-4 lg:px-6 py-4 lg:py-5">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
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
            <div className="flex flex-wrap items-center gap-2 lg:gap-4 mt-3 text-xs text-muted">
              <span className="font-medium text-foreground">Motions:</span>
              {(Object.entries(MOTION_CONFIG) as [Motion, typeof MOTION_CONFIG.sales][]).map(([key, val]) => (
                <span key={key} className="flex items-center gap-1">
                  <MotionBadge motion={key} />
                </span>
              ))}
            </div>
          </div>

          {/* Dashboard table */}
          <div className="max-w-6xl mx-auto px-4 lg:px-6 pb-12">
            <div className="border border-border rounded-xl overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-zinc-50 border-b border-border text-xs text-muted uppercase tracking-wider">
                    <th className="w-8 py-2.5 px-4"></th>
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        onClick={() => handleSort(col.key)}
                        className={`py-2.5 pr-4 ${col.align} font-medium cursor-pointer hover:text-foreground transition-colors select-none ${col.hideOnMobile ? "hidden lg:table-cell" : ""}`}
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
              Click column headers to sort. Click any row to expand details. PMF target is 80%.
            </p>
          </div>
        </>
      )}

      {tab === "lab" && (
        <div className="max-w-6xl mx-auto px-4 lg:px-6 py-6 pb-12">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground">Proposed PMF Experiments</h2>
            <p className="text-sm text-muted mt-1">
              Vote on experiments to prioritize. Click any row to see the full hypothesis.
            </p>
          </div>

          {/* Definitions */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4 mb-6">
            <div className="border border-border rounded-lg px-4 py-3">
              <div className="text-sm font-semibold text-foreground mb-1">Product-Market Fit (PMF)</div>
              <p className="text-xs text-muted">
                The point where your product clicks with a market. We measure it as: of people who experience the
                {" "}<span className="font-medium text-foreground">magic moment</span>, what % take the next step? Target: 80%.
              </p>
            </div>
            <div className="border border-border rounded-lg px-4 py-3">
              <div className="text-sm font-semibold text-foreground mb-1">The Magic Moment</div>
              <p className="text-xs text-muted">
                For AccountCast, this is the <span className="font-medium text-foreground">{"\u201C"}at last{"\u201D"} reaction</span> {"\u2014"} when
                a B2B marketer realizes they can finally use the power of television with the precision of account-based targeting.
              </p>
            </div>
            <div className="border border-border rounded-lg px-4 py-3">
              <div className="text-sm font-semibold text-foreground mb-1">How We Experiment</div>
              <p className="text-xs text-muted">
                Each experiment tests one hypothesis: can we deliver the magic moment through a specific channel and
                convert it with a specific CTA? Run fast, measure everything, kill what doesn{"\u2019"}t work.
              </p>
            </div>
          </div>

          <div className="border border-border rounded-xl overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-50 border-b border-border text-xs text-muted uppercase tracking-wider">
                  <th className="w-8 py-2.5 px-4"></th>
                  <th className="py-2.5 pr-4 text-left font-medium">Experiment</th>
                  <th className="py-2.5 pr-4 text-left font-medium hidden lg:table-cell" colSpan={2}>CTA to test</th>
                  <th className="py-2.5 pr-4 text-left font-medium hidden lg:table-cell" colSpan={2}>Start date</th>
                  <th className="py-2.5 pr-4 text-center font-medium">Vote</th>
                </tr>
              </thead>
              <tbody>
                {proposals.map((p) => (
                  <ProposalRow
                    key={p.id}
                    proposal={p}
                    onDateChange={(id, date) =>
                      setProposals((prev) =>
                        prev.map((x) => (x.id === id ? { ...x, startDate: date } : x))
                      )
                    }
                  />
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-zinc-400 mt-3">
            Click any row to expand. Run experiments fast, measure PMF, double down on what works.
          </p>

          <AddExperimentForm onAdd={(p) => setProposals((prev) => [...prev, p])} />
        </div>
      )}
    </div>
  );
}

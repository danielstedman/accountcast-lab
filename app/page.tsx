"use client";

import { useState, useMemo, useEffect, useCallback, forwardRef } from "react";
import { CAMPAIGNS, PROPOSED_EXPERIMENTS } from "@/lib/seed-data";
import { Campaign, Confidence, Motion, ProposedExperiment } from "@/lib/types";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { loadProposalsState, saveProposalsState } from "@/lib/proposals-store";

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

interface TamData {
  total: number;
  touched: number;
  untouched: number;
  multiChannel: number;
  coverage: number;
  touchedAccounts: {
    company: string;
    domain: string;
    industry: string;
    size: string;
    channels: string[];
    touchCount: number;
    contacts?: { name: string; email: string; campaign: string; sent: boolean; opened: boolean; replied: boolean }[];
  }[];
}

interface LemlistStats {
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
}

interface LemlistCampaign {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  included: boolean;
  seedId: string | null;
  stats: LemlistStats | null;
}

type SortKey = "name" | "startDate" | "targeted" | "reached" | "replies" | "conversion" | "meetings" | "pmfScore" | "confidence";
type SortDir = "asc" | "desc";
type Tab = "dashboard" | "lab" | "tam";

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

function formatStartDate(iso: string | undefined): string {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "\u2014";
  return d.toLocaleString("en-US", { month: "short", day: "numeric" });
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
        <td className="py-3 pr-4 text-sm font-mono text-right hidden lg:table-cell whitespace-nowrap">
          {c.startDate
            ? <span className="text-foreground">{formatStartDate(c.startDate)}</span>
            : <span className="text-zinc-300">{"\u2014"}</span>}
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
          <td colSpan={9} className="py-3 pr-6">
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

type ProposalStatus = "approved" | "postponed" | "cancelled" | null;

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string; rowBg: string }> = {
  approved: { label: "Go!", bg: "bg-emerald-100", text: "text-emerald-700", rowBg: "bg-emerald-50/50" },
  postponed: { label: "Later", bg: "bg-amber-100", text: "text-amber-700", rowBg: "bg-amber-50/30" },
  cancelled: { label: "No", bg: "bg-red-100", text: "text-red-600", rowBg: "bg-red-50/30" },
};

const ProposalRow = forwardRef<HTMLTableRowElement, {
  proposal: ProposedExperiment;
  status: ProposalStatus;
  onDateChange: (id: string, date: string) => void;
  onStatusChange: (id: string, status: ProposalStatus) => void;
  dragHandleProps?: Record<string, unknown>;
  draggableProps?: Record<string, unknown>;
}>(function ProposalRow({ proposal, status, onDateChange, onStatusChange, dragHandleProps, draggableProps }, ref) {
  const p = proposal;
  const [open, setOpen] = useState(false);
  const isCancelled = status === "cancelled";

  return (
    <>
      <tr
        ref={ref}
        {...(draggableProps || {})}
        className={`border-b border-border hover:bg-zinc-50 transition-colors ${open ? "bg-zinc-50" : ""} ${status ? STATUS_CONFIG[status].rowBg : ""}`}
      >
        <td className="py-3 px-2" {...(dragHandleProps || {})}>
          <span className="text-zinc-400 cursor-grab text-sm">{"\u2261"}</span>
        </td>
        <td className="py-3 pr-4 cursor-pointer" onClick={() => setOpen(!open)}>
          <div className="flex items-center gap-2">
            {status && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_CONFIG[status].bg} ${STATUS_CONFIG[status].text}`}>
                {STATUS_CONFIG[status].label}
              </span>
            )}
            <div className={`font-medium text-sm ${isCancelled ? "line-through text-zinc-400" : status === "approved" ? "text-emerald-700" : "text-foreground"}`}>{p.name}</div>
            <span className={isCancelled ? "opacity-50" : ""}><MotionBadge motion={p.motion} /></span>
          </div>
          <div className="text-xs text-muted">{p.channel} {"\u00B7"} {p.durationWeeks} week{p.durationWeeks > 1 ? "s" : ""}</div>
        </td>
        <td className="py-3 pr-4 text-sm text-muted cursor-pointer hidden lg:table-cell" onClick={() => setOpen(!open)}>
          <span className={isCancelled ? "line-through text-zinc-300" : ""}>{p.ctaTested}</span>
        </td>
        <td className="py-3 pr-4 hidden lg:table-cell">
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
              onClick={() => onStatusChange(p.id, status === "approved" ? null : "approved")}
              className={`px-1.5 py-1 text-xs rounded transition-colors ${
                status === "approved" ? "bg-emerald-200 text-emerald-800" : "bg-zinc-100 text-zinc-400 hover:bg-emerald-50 hover:text-emerald-600"
              }`}
              title="Approve"
            >{"\u2714"}</button>
            <button
              onClick={() => onStatusChange(p.id, status === "postponed" ? null : "postponed")}
              className={`px-1.5 py-1 text-xs rounded transition-colors ${
                status === "postponed" ? "bg-amber-200 text-amber-800" : "bg-zinc-100 text-zinc-400 hover:bg-amber-50 hover:text-amber-600"
              }`}
              title="Postpone"
            >{"\u23F8"}</button>
            <button
              onClick={() => onStatusChange(p.id, status === "cancelled" ? null : "cancelled")}
              className={`px-1.5 py-1 text-xs rounded transition-colors ${
                status === "cancelled" ? "bg-red-200 text-red-800" : "bg-zinc-100 text-zinc-400 hover:bg-red-50 hover:text-red-600"
              }`}
              title="Cancel"
            >{"\u2716"}</button>
          </div>
        </td>
      </tr>
      {open && (
        <tr className="border-b border-border bg-zinc-50">
          <td></td>
          <td colSpan={5} className="py-3 pr-6">
            <div className="space-y-2">
              {p.hypothesis && (
                <div>
                  <span className="text-xs font-medium text-muted uppercase tracking-wider">Hypothesis</span>
                  <p className="text-sm text-zinc-600 mt-0.5">{p.hypothesis}</p>
                </div>
              )}
              {p.successCriteria && (
                <div>
                  <span className="text-xs font-medium text-muted uppercase tracking-wider">Success criteria</span>
                  <p className="text-sm text-zinc-600 mt-0.5">{p.successCriteria}</p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
});

function TamAccountRow({ account }: { account: TamData["touchedAccounts"][0] }) {
  const [open, setOpen] = useState(false);
  const a = account;

  return (
    <>
      <tr
        onClick={() => setOpen(!open)}
        className={`border-b border-border hover:bg-zinc-50 cursor-pointer transition-colors ${open ? "bg-zinc-50" : ""}`}
      >
        <td className="py-2.5 px-4">
          <span className="text-zinc-400 text-sm">{open ? "\u25BE" : "\u25B8"}</span>
        </td>
        <td className="py-2.5 pr-4">
          <div className="font-medium text-sm text-foreground">{a.company}</div>
          <div className="text-xs text-muted">{a.domain}</div>
        </td>
        <td className="py-2.5 pr-4 text-xs text-muted hidden lg:table-cell">{a.industry}</td>
        <td className="py-2.5 pr-4 text-center">
          <span className={`text-sm font-mono font-semibold ${
            a.touchCount >= 3 ? "text-emerald-600" : a.touchCount >= 2 ? "text-accent" : "text-foreground"
          }`}>
            {a.touchCount}
          </span>
        </td>
        <td className="py-2.5 pr-4">
          <div className="flex flex-wrap gap-1">
            {a.channels.map((ch) => (
              <span key={ch} className="px-1.5 py-0.5 text-[10px] rounded bg-zinc-100 text-muted">
                {ch}
              </span>
            ))}
          </div>
        </td>
      </tr>
      {open && a.contacts && a.contacts.length > 0 && (
        <tr className="border-b border-border bg-zinc-50">
          <td></td>
          <td colSpan={4} className="py-3 pr-6">
            <div className="text-xs font-medium text-muted uppercase tracking-wider mb-2">
              Contacts reached at {a.company}
            </div>
            <div className="space-y-1">
              {a.contacts.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-zinc-200/60 last:border-0">
                  <div>
                    <span className="font-medium text-foreground">{c.name}</span>
                    <span className="text-muted ml-2">{c.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-muted">{c.campaign}</span>
                    <span className="flex gap-1">
                      {c.sent && <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 text-[10px]">Sent</span>}
                      {c.opened && <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 text-[10px]">Opened</span>}
                      {c.replied && <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[10px]">Replied</span>}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function AddIdeaInput({ onAdd }: { onAdd: (p: ProposedExperiment) => void }) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!value.trim()) return;
    onAdd({
      id: `prop-${Date.now()}`,
      name: value.trim(),
      channel: "",
      motion: "sales",
      hypothesis: "",
      ctaTested: "",
      durationWeeks: 2,
      successCriteria: "",
      defaultScore: 0,
      startDate: "",
    });
    setValue("");
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="flex-1 px-3 py-2 text-sm border border-dashed border-accent/40 rounded-lg bg-white placeholder:text-zinc-400 focus:outline-none focus:border-accent"
        placeholder="Add a new experiment idea..."
      />
      <button
        type="submit"
        className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent-light transition-colors"
      >
        Add
      </button>
    </form>
  );
}

export default function Home() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [sortKey, setSortKey] = useState<SortKey | null>("startDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [proposals, setProposals] = useState(PROPOSED_EXPERIMENTS);
  const [statuses, setStatuses] = useState<Record<string, ProposalStatus>>({});
  const [loaded, setLoaded] = useState(false);

  // Load saved state on mount
  useEffect(() => {
    loadProposalsState().then((saved) => {
      if (saved) {
        const orderMap = new Map(saved.order.map((id, i) => [id, i]));
        const sorted = [...PROPOSED_EXPERIMENTS].sort((a, b) => {
          const ai = orderMap.get(a.id) ?? 999;
          const bi = orderMap.get(b.id) ?? 999;
          return ai - bi;
        });
        const savedIds = new Set(saved.order);
        const newOnes = PROPOSED_EXPERIMENTS.filter(p => !savedIds.has(p.id));
        setProposals([...sorted.filter(p => savedIds.has(p.id)), ...newOnes].map(p => ({
          ...p,
          startDate: saved.dates[p.id] || p.startDate,
        })));
        setStatuses(saved.statuses);
      }
      setLoaded(true);
    });
  }, []);

  // Save state on every change (after initial load)
  const persistState = useCallback(() => {
    if (!loaded) return;
    saveProposalsState({
      order: proposals.map(p => p.id),
      statuses,
      dates: Object.fromEntries(proposals.map(p => [p.id, p.startDate])),
    });
  }, [proposals, statuses, loaded]);

  useEffect(() => {
    persistState();
  }, [persistState]);
  const [pipeline, setPipeline] = useState<PipelineData | null>(null);
  const [lemlistData, setLemlistData] = useState<LemlistCampaign[] | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [pendingIncluded, setPendingIncluded] = useState<Set<string> | null>(null);
  const [savingIncluded, setSavingIncluded] = useState(false);
  const [tamData, setTamData] = useState<TamData | null>(null);
  const [defsOpen, setDefsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [apiStatus, setApiStatus] = useState<Record<string, "loading" | "done" | "error">>({});
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  const openManage = useCallback(() => {
    if (!lemlistData) return;
    setPendingIncluded(new Set(lemlistData.filter((c) => c.included).map((c) => c.id)));
    setManageOpen(true);
  }, [lemlistData]);

  const cancelManage = useCallback(() => {
    setPendingIncluded(null);
    setManageOpen(false);
  }, []);

  const togglePending = useCallback((id: string) => {
    setPendingIncluded((prev) => {
      if (!prev) return prev;
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const saveManage = useCallback(async () => {
    if (!pendingIncluded) return;
    setSavingIncluded(true);
    try {
      const ids = Array.from(pendingIncluded);
      await fetch("/api/lemlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ included: ids }),
      });
      const res = await fetch("/api/lemlist");
      const data = await res.json();
      setLemlistData(data.campaigns || []);
      setManageOpen(false);
      setPendingIncluded(null);
    } finally {
      setSavingIncluded(false);
    }
  }, [pendingIncluded]);

  const refreshAll = useCallback(() => {
    setRefreshing(true);
    setApiStatus({ pipedrive: "loading", lemlist: "loading", tam: "loading" });

    const fetches = [
      fetch("/api/pipeline")
        .then((r) => r.json())
        .then((data) => {
          setPipeline(data);
          setApiStatus((prev) => ({ ...prev, pipedrive: data.error ? "error" : "done" }));
        })
        .catch(() => setApiStatus((prev) => ({ ...prev, pipedrive: "error" }))),
      fetch("/api/lemlist")
        .then((r) => r.json())
        .then((data) => {
          setLemlistData(data.campaigns || []);
          setApiStatus((prev) => ({ ...prev, lemlist: data.error ? "error" : "done" }));
        })
        .catch(() => setApiStatus((prev) => ({ ...prev, lemlist: "error" }))),
      fetch("/api/tam")
        .then((r) => r.json())
        .then((data) => {
          setTamData(data);
          setApiStatus((prev) => ({ ...prev, tam: data.error ? "error" : "done" }));
        })
        .catch(() => setApiStatus((prev) => ({ ...prev, tam: "error" }))),
    ];

    Promise.all(fetches).then(() => {
      setRefreshing(false);
      setLastRefresh(new Date().toLocaleTimeString());
    });
  }, []);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  // Merge live Lemlist data into campaigns. Non-Lemlist seed entries always
  // pass through. Lemlist rows come exclusively from the live/snapshot data:
  // an included campaign with a matching seed inherits the curated framing,
  // anything else gets synthesized from raw stats. Toggling a campaign off
  // hides it from the dashboard entirely.
  const campaignsWithLive = useMemo(() => {
    if (!lemlistData) return CAMPAIGNS;

    const nonLemlistSeed = CAMPAIGNS.filter((c) => !c.id.startsWith("lemlist-"));
    const seedById = Object.fromEntries(
      CAMPAIGNS.filter((c) => c.id.startsWith("lemlist-")).map((c) => [c.id, c])
    );

    const lemlistRows: Campaign[] = lemlistData
      .filter((c) => c.included && c.stats)
      .map((c) => {
        const stats = c.stats!;
        const openRate = stats.sent > 0
          ? `${Math.round((stats.opened / stats.sent) * 100)}%`
          : "0%";
        const replyRate = stats.sent > 0
          ? `${((stats.replied / stats.sent) * 100).toFixed(1)}%`
          : "0%";
        const details = [
          { label: "Emails sent", value: stats.sent },
          { label: "Opened", value: stats.opened, rate: openRate },
          { label: "Replied", value: stats.replied, rate: replyRate },
          { label: "Clicked", value: stats.clicked },
          { label: "Bounced", value: stats.bounced },
        ];
        const seed = c.seedId ? seedById[c.seedId] : null;
        if (seed && (stats.sent > 0 || stats.opened > 0 || stats.replied > 0)) {
          return {
            ...seed,
            startDate: c.createdAt || seed.startDate,
            targeted: stats.sent,
            reached: stats.opened,
            replies: stats.replied,
            conversion: replyRate,
            confidence: "high" as const,
            confidenceNote: "Live data from Lemlist API.",
            details,
          };
        }
        if (seed) return { ...seed, startDate: c.createdAt || seed.startDate };

        const created = c.createdAt ? new Date(c.createdAt) : null;
        const dateRange = created
          ? `${created.toLocaleString("en-US", { month: "short", day: "numeric" })} — present`
          : "";
        const status: Campaign["status"] =
          c.status === "running" ? "active" : c.status === "paused" ? "paused" : "planned";
        return {
          id: `lemlist-${c.id}`,
          name: `Lemlist — ${c.name}`,
          channel: "Lemlist",
          mode: "Email",
          motion: "sales" as const,
          status,
          dateRange,
          startDate: c.createdAt || undefined,
          targeted: stats.sent,
          reached: stats.opened,
          replies: stats.replied,
          conversion: replyRate,
          meetings: 0,
          pmfScore: null,
          pmfNote: "Auto-discovered campaign — add a hand-curated entry in seed-data.ts to score PMF.",
          confidence: "high" as const,
          confidenceNote: "Live data from Lemlist API.",
          details,
          notes: "",
        };
      });

    return [...nonLemlistSeed, ...lemlistRows];
  }, [lemlistData]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "desc" ? "asc" : "desc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = useMemo(() => {
    if (!sortKey) return campaignsWithLive;
    return [...campaignsWithLive].sort((a, b) => {
      let aVal: number;
      let bVal: number;
      if (sortKey === "name") {
        const cmp = a.name.localeCompare(b.name);
        return sortDir === "asc" ? cmp : -cmp;
      } else if (sortKey === "startDate") {
        // Missing dates always sort to the bottom regardless of direction.
        const aT = a.startDate ? new Date(a.startDate).getTime() : null;
        const bT = b.startDate ? new Date(b.startDate).getTime() : null;
        if (aT === null && bT === null) return 0;
        if (aT === null) return 1;
        if (bT === null) return -1;
        return sortDir === "asc" ? aT - bT : bT - aT;
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
  }, [sortKey, sortDir, campaignsWithLive]);

  const totalMeetings = campaignsWithLive.reduce((a, c) => a + c.meetings, 0);
  const withPmf = campaignsWithLive.filter((c) => c.pmfScore !== null && c.pmfScore > 0);
  const bestPmf = withPmf.length > 0 ? Math.max(...withPmf.map((c) => c.pmfScore!)) : null;

  const columns: { key: SortKey; label: string; align: string; hideOnMobile?: boolean }[] = [
    { key: "name", label: "Campaign", align: "text-left" },
    { key: "startDate", label: "Started", align: "text-right", hideOnMobile: true },
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
              <span className="text-muted font-normal ml-1.5">Dashboard</span>
            </h1>
            <p className="text-sm text-muted mt-0.5">
              Growth experiments {"\u2014"} at a glance
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              {Object.entries(apiStatus).map(([name, status]) => (
                <span key={name} className="flex items-center gap-1" title={`${name}: ${status}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    status === "done" ? "bg-emerald-500" :
                    status === "loading" ? "bg-amber-400 animate-pulse" :
                    status === "error" ? "bg-red-400" : "bg-zinc-300"
                  }`} />
                  <span className="text-[10px] text-muted hidden sm:inline">{name}</span>
                </span>
              ))}
            </div>
            <button
              onClick={refreshAll}
              disabled={refreshing}
              className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                refreshing
                  ? "border-zinc-200 text-zinc-400 cursor-wait"
                  : "border-border text-muted hover:text-foreground hover:border-zinc-400"
              }`}
            >
              {refreshing ? "Refreshing..." : "Refresh"}
            </button>
            {lastRefresh && (
              <span className="text-[10px] text-zinc-400 hidden sm:inline">{lastRefresh}</span>
            )}
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
          <button
            onClick={() => setTab("tam")}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap ${
              tab === "tam"
                ? "bg-white text-foreground border border-border border-b-white -mb-px"
                : "text-muted hover:text-foreground"
            }`}
          >
            TAM Coverage
            {tamData && (
              <span className="ml-1.5 text-xs bg-zinc-100 text-muted px-1.5 py-0.5 rounded-full">
                {tamData.coverage}%
              </span>
            )}
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
                <div className="text-2xl font-bold font-mono mt-0.5">{campaignsWithLive.length}</div>
                <div className="text-xs text-muted">
                  {campaignsWithLive.filter((c) => c.status === "active").length} active \u00B7 {campaignsWithLive.filter((c) => c.status === "planned").length} planned
                </div>
              </div>
              <div className="border border-border rounded-lg px-4 py-3">
                <div className="text-xs text-muted uppercase tracking-wide">Total targeted</div>
                <div className="text-2xl font-bold font-mono mt-0.5">
                  {campaignsWithLive.reduce((a, c) => a + (typeof c.targeted === "number" ? c.targeted : 0), 0).toLocaleString()}
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

          {/* Lemlist sync */}
          {lemlistData && (
            <div className="max-w-6xl mx-auto px-4 lg:px-6 mb-3">
              <div className="border border-border rounded-lg px-3 py-2 flex items-center justify-between gap-3 text-xs">
                <div className="text-muted">
                  <span className="text-foreground font-medium">Lemlist sync</span>
                  {" · "}
                  tracking {lemlistData.filter((c) => c.included).length} of {lemlistData.length} campaigns since Feb 1, 2026
                </div>
                {!manageOpen ? (
                  <button
                    onClick={openManage}
                    className="px-2.5 py-1 rounded-md border border-border text-muted hover:text-foreground hover:border-zinc-400 transition-colors"
                  >
                    Manage ▸
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={cancelManage}
                      disabled={savingIncluded}
                      className="px-2.5 py-1 rounded-md border border-border text-muted hover:text-foreground hover:border-zinc-400 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={saveManage}
                      disabled={savingIncluded}
                      className="px-2.5 py-1 rounded-md bg-accent text-white hover:bg-accent-light transition-colors disabled:opacity-50"
                    >
                      {savingIncluded ? "Saving…" : "Save"}
                    </button>
                  </div>
                )}
              </div>
              {manageOpen && pendingIncluded && (
                <div className="border border-border border-t-0 rounded-b-lg max-h-72 overflow-y-auto">
                  <p className="text-xs text-muted px-3 py-2 border-b border-border bg-zinc-50">
                    Tick a campaign to include it on the dashboard. Newly discovered campaigns default to off.
                  </p>
                  <ul>
                    {lemlistData.map((c) => {
                      const created = c.createdAt ? new Date(c.createdAt) : null;
                      const dateLabel = created
                        ? created.toLocaleString("en-US", { month: "short", day: "numeric" })
                        : "—";
                      const checked = pendingIncluded.has(c.id);
                      return (
                        <li
                          key={c.id}
                          className="flex items-center gap-3 px-3 py-1.5 border-b border-border last:border-0 hover:bg-zinc-50 cursor-pointer"
                          onClick={() => togglePending(c.id)}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => togglePending(c.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="cursor-pointer"
                          />
                          <span className="flex-1 text-xs text-foreground truncate">{c.name}</span>
                          <span className={`text-[10px] uppercase tracking-wider ${
                            c.status === "running" ? "text-emerald-600" :
                            c.status === "paused" ? "text-amber-600" :
                            c.status === "ended" ? "text-zinc-400" : "text-muted"
                          }`}>
                            {c.status}
                          </span>
                          <span className="text-[10px] text-zinc-400 w-12 text-right">{dateLabel}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          )}

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

          {/* Definitions — collapsible on mobile, always visible on desktop */}
          <div className="mb-6">
            <button
              onClick={() => setDefsOpen(!defsOpen)}
              className="flex items-center gap-2 text-sm font-medium text-muted hover:text-foreground transition-colors lg:hidden mb-2"
            >
              <span>{defsOpen ? "\u25BE" : "\u25B8"}</span>
              What is PMF? How do we measure it?
            </button>
            <div className={`${defsOpen ? "block" : "hidden"} lg:block`}>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 lg:gap-4">
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
            </div>
          </div>

          <div className="border border-border rounded-xl overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-zinc-50 border-b border-border text-xs text-muted uppercase tracking-wider">
                  <th className="w-8 py-2.5 px-4"></th>
                  <th className="py-2.5 pr-4 text-left font-medium">Experiment</th>
                  <th className="py-2.5 pr-4 text-left font-medium hidden lg:table-cell">CTA to test</th>
                  <th className="py-2.5 pr-4 text-left font-medium hidden lg:table-cell">Start date</th>
                  <th className="py-2.5 pr-4 text-center font-medium">Status</th>
                </tr>
              </thead>
              <DragDropContext onDragEnd={(result: DropResult) => {
                if (!result.destination) return;
                const items = [...proposals];
                const [moved] = items.splice(result.source.index, 1);
                items.splice(result.destination.index, 0, moved);
                setProposals(items);
              }}>
                <Droppable droppableId="proposals">
                  {(provided) => (
                    <tbody ref={provided.innerRef} {...provided.droppableProps}>
                      {proposals.map((p, i) => (
                        <Draggable key={p.id} draggableId={p.id} index={i}>
                          {(dragProvided) => (
                            <ProposalRow
                              proposal={p}
                              status={statuses[p.id] || null}
                              draggableProps={dragProvided.draggableProps as unknown as Record<string, unknown>}
                              dragHandleProps={dragProvided.dragHandleProps as unknown as Record<string, unknown>}
                              onDateChange={(id, date) =>
                                setProposals((prev) =>
                                  prev.map((x) => (x.id === id ? { ...x, startDate: date } : x))
                                )
                              }
                              onStatusChange={(id, s) =>
                                setStatuses((prev) => ({ ...prev, [id]: s }))
                              }
                              ref={dragProvided.innerRef}
                            />
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </tbody>
                  )}
                </Droppable>
              </DragDropContext>
            </table>
          </div>
          <p className="text-xs text-zinc-400 mt-3">
            Click any row to expand. Run experiments fast, measure PMF, double down on what works.
          </p>

          <AddIdeaInput onAdd={(p) => setProposals((prev) => [...prev, p])} />
        </div>
      )}

      {tab === "tam" && (
        <div className="max-w-6xl mx-auto px-4 lg:px-6 py-6 pb-12">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground">Target Account Coverage</h2>
            <p className="text-sm text-muted mt-1">
              How much of our TAM have we touched across all channels?
            </p>
          </div>

          {!tamData ? (
            <p className="text-sm text-muted">Loading TAM data...</p>
          ) : (
            <>
              {/* Summary */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
                <div className="border border-border rounded-lg px-4 py-3">
                  <div className="text-xs text-muted uppercase tracking-wide">Total TAM</div>
                  <div className="text-2xl font-bold font-mono mt-0.5">{tamData.total.toLocaleString()}</div>
                  <div className="text-xs text-muted">target accounts</div>
                </div>
                <div className="border border-border rounded-lg px-4 py-3">
                  <div className="text-xs text-muted uppercase tracking-wide">Accounts touched</div>
                  <div className="text-2xl font-bold font-mono mt-0.5">{tamData.touched}</div>
                  <div className="text-xs text-muted">{tamData.coverage}% coverage</div>
                </div>
                <div className="border border-border rounded-lg px-4 py-3">
                  <div className="text-xs text-muted uppercase tracking-wide">Multi-channel</div>
                  <div className="text-2xl font-bold font-mono mt-0.5">{tamData.multiChannel}</div>
                  <div className="text-xs text-muted">touched by 2+ campaigns</div>
                </div>
                <div className="border border-border rounded-lg px-4 py-3">
                  <div className="text-xs text-muted uppercase tracking-wide">Untouched</div>
                  <div className="text-2xl font-bold font-mono mt-0.5 text-zinc-400">{tamData.untouched.toLocaleString()}</div>
                  <div className="text-xs text-muted">{(100 - tamData.coverage).toFixed(1)}% of TAM</div>
                </div>
              </div>

              {/* Coverage bar */}
              <div className="mb-6">
                <div className="flex justify-between text-xs text-muted mb-1">
                  <span>TAM Coverage</span>
                  <span>{tamData.coverage}%</span>
                </div>
                <div className="w-full h-3 bg-zinc-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent rounded-full transition-all"
                    style={{ width: `${Math.max(tamData.coverage, 1)}%` }}
                  />
                </div>
              </div>

              {/* Touched accounts table */}
              <div className="border border-border rounded-xl overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-zinc-50 border-b border-border text-xs text-muted uppercase tracking-wider">
                      <th className="w-8 py-2.5 px-4"></th>
                      <th className="py-2.5 pr-4 text-left font-medium">Account</th>
                      <th className="py-2.5 pr-4 text-left font-medium hidden lg:table-cell">Industry</th>
                      <th className="py-2.5 pr-4 text-center font-medium">Touches</th>
                      <th className="py-2.5 pr-4 text-left font-medium">Channels</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tamData.touchedAccounts.map((a) => (
                      <TamAccountRow key={a.domain} account={a} />
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-zinc-400 mt-3">
                Showing accounts from TAM that have been touched by at least one campaign. Sorted by number of channel touches.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

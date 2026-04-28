import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

const BASE_URL = "https://api.lemlist.com/api";
const MIN_CAMPAIGN_DATE = "2026-02-01";
const REDIS_KEY = "lemlist-included-campaigns";

const DEFAULT_INCLUDED: string[] = [
  "cam_BNmQsFaGTLY3yXkXF", // AccountCast (Danny)
  "cam_mu9WWo7NqjpwXubWh", // Tier1 Mar31 SeqA KM
  "cam_G222d33RL99aTLGto", // Scott's Customer Interview Push
  "cam_JL7ZR82ZcPauxQM5W", // AccountCast Launch
  "cam_6doAkRNxHY3zonPWw", // SequenceC Apr20 w/ Lead Magnet
];

// Maps Lemlist campaign IDs to seed-data Campaign IDs so the dashboard keeps
// hand-curated framing (PMF notes, audiences, motion) for known campaigns.
// Anything not mapped here renders as a synthesized row from live data.
const SEED_ID_BY_LEMLIST_ID: Record<string, string> = {
  cam_BNmQsFaGTLY3yXkXF: "lemlist-danny",
  cam_mu9WWo7NqjpwXubWh: "lemlist-kyla",
  cam_G222d33RL99aTLGto: "lemlist-scott-interview",
  cam_JL7ZR82ZcPauxQM5W: "lemlist-launch",
};

interface CampaignStats {
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
}

interface DiscoveredCampaign {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  included: boolean;
  seedId: string | null;
  stats: CampaignStats | null;
}

interface LemlistListItem {
  _id: string;
  name?: string;
  status?: string;
  createdAt?: string;
}

function authHeader(token: string) {
  return { Authorization: "Basic " + btoa(":" + token) };
}

function getRedis() {
  const url = process.env.accountcast_dash_KV_REST_API_URL;
  const token = process.env.accountcast_dash_KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

async function loadIncluded(): Promise<Set<string>> {
  const redis = getRedis();
  if (!redis) return new Set(DEFAULT_INCLUDED);
  const stored = await redis.get<string[]>(REDIS_KEY);
  if (!stored || !Array.isArray(stored)) return new Set(DEFAULT_INCLUDED);
  return new Set(stored);
}

async function saveIncluded(ids: string[]): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  await redis.set(REDIS_KEY, ids);
  return true;
}

async function listAllCampaigns(token: string): Promise<LemlistListItem[] | null> {
  const all: LemlistListItem[] = [];
  let offset = 0;
  while (true) {
    const res = await fetch(
      `${BASE_URL}/campaigns?limit=100&offset=${offset}`,
      { headers: authHeader(token), cache: "no-store" }
    );
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...(data as LemlistListItem[]));
    if (data.length < 100) break;
    offset += 100;
  }
  return all;
}

async function fetchStats(token: string, id: string): Promise<CampaignStats> {
  let sent = 0, opened = 0, clicked = 0, replied = 0, bounced = 0;
  let offset = 0;
  while (true) {
    const res = await fetch(
      `${BASE_URL}/activities?campaignId=${id}&limit=100&offset=${offset}`,
      { headers: authHeader(token), cache: "no-store" }
    );
    if (!res.ok) break;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    for (const a of data) {
      switch (a.type) {
        case "emailsSent": sent++; break;
        case "emailsOpened": opened++; break;
        case "emailsClicked": clicked++; break;
        case "emailsReplied": replied++; break;
        case "emailsBounced": bounced++; break;
      }
    }
    if (data.length < 100) break;
    offset += 100;
  }
  return { sent, opened, clicked, replied, bounced };
}

async function fetchLive(
  token: string,
  included: Set<string>
): Promise<DiscoveredCampaign[] | null> {
  const all = await listAllCampaigns(token);
  if (!all) return null;

  const minMs = new Date(MIN_CAMPAIGN_DATE).getTime();
  const recent = all.filter((c) => {
    const t = c.createdAt ? new Date(c.createdAt).getTime() : 0;
    return t >= minMs;
  });

  const statsEntries = await Promise.all(
    recent
      .filter((c) => included.has(c._id))
      .map(async (c) => [c._id, await fetchStats(token, c._id)] as const)
  );
  const statsMap = new Map(statsEntries);

  return recent
    .map<DiscoveredCampaign>((c) => ({
      id: c._id,
      name: c.name || "(unnamed)",
      status: c.status || "unknown",
      createdAt: c.createdAt || "",
      included: included.has(c._id),
      seedId: SEED_ID_BY_LEMLIST_ID[c._id] || null,
      stats: statsMap.get(c._id) || null,
    }))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

interface SnapshotEntry {
  id: string;
  name: string;
  status: string;
  createdAt?: string;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
}

function loadFromFile(included: Set<string>): DiscoveredCampaign[] | null {
  try {
    const filePath = join(process.cwd(), "data", "lemlist-campaigns.json");
    const raw = readFileSync(filePath, "utf-8");
    const parsed: SnapshotEntry[] = JSON.parse(raw);
    const minMs = new Date(MIN_CAMPAIGN_DATE).getTime();
    return parsed
      .filter((c) => {
        if (!c.createdAt) return true; // legacy snapshot rows pass through
        return new Date(c.createdAt).getTime() >= minMs;
      })
      .map<DiscoveredCampaign>((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        createdAt: c.createdAt || "",
        included: included.has(c.id),
        seedId: SEED_ID_BY_LEMLIST_ID[c.id] || null,
        stats: included.has(c.id)
          ? {
              sent: c.sent,
              opened: c.opened,
              clicked: c.clicked,
              replied: c.replied,
              bounced: c.bounced,
            }
          : null,
      }));
  } catch {
    return null;
  }
}

export async function GET() {
  const token = process.env.LEMLIST_API_KEY;
  const included = await loadIncluded();

  if (token) {
    const live = await fetchLive(token, included);
    if (live) {
      return NextResponse.json({ campaigns: live, source: "live" });
    }
  }

  const file = loadFromFile(included);
  if (file) {
    return NextResponse.json({ campaigns: file, source: "snapshot" });
  }

  return NextResponse.json(
    { error: "No Lemlist data available", campaigns: [] },
    { status: 200 }
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !Array.isArray(body.included)) {
    return NextResponse.json(
      { error: "Expected { included: string[] }" },
      { status: 400 }
    );
  }
  const ids: string[] = body.included.filter(
    (x: unknown): x is string => typeof x === "string"
  );
  const ok = await saveIncluded(ids);
  if (!ok) {
    return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, included: ids });
}

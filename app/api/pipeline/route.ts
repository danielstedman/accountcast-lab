import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const API_TOKEN = process.env.PIPEDRIVE_API_TOKEN;
const BASE_URL = "https://api.pipedrive.com/v1";
const ACCOUNTCAST_PIPELINE_ID = 5;

// Current AccountCast pipeline stages (updated Apr 8 2026)
const STAGE_NAMES: Record<number, string> = {
  26: "Qualification",
  28: "Proposal/Scope",
  31: "Negotiation",
};

const DISPLAY_BUCKETS: { name: string; stageIds: number[] }[] = [
  { name: "Qualification", stageIds: [26] },
  { name: "Proposal/Scope", stageIds: [28] },
  { name: "Negotiation", stageIds: [31] },
];

interface Deal {
  id: number;
  title: string;
  value: number;
  currency: string;
  stage_id: number;
  stage: string;
  status: string;
  org_name: string | null;
}

async function fetchDeals(status: string): Promise<Deal[]> {
  const deals: Deal[] = [];
  let start = 0;
  const limit = 100;

  while (true) {
    const params = new URLSearchParams({
      api_token: API_TOKEN!,
      start: String(start),
      limit: String(limit),
      status,
    });

    const res = await fetch(
      `${BASE_URL}/pipelines/${ACCOUNTCAST_PIPELINE_ID}/deals?${params}`,
      { cache: "no-store" }
    );
    const json = await res.json();

    if (!json.success) break;
    if (json.data) {
      for (const d of json.data) {
        deals.push({
          id: d.id,
          title: d.title,
          value: d.value || 0,
          currency: d.currency || "USD",
          stage_id: d.stage_id,
          stage: STAGE_NAMES[d.stage_id] || `Stage ${d.stage_id}`,
          status: d.status,
          org_name: d.org_name || null,
        });
      }
    }
    if (json.additional_data?.pagination?.more_items_in_collection) {
      start = json.additional_data.pagination.next_start;
    } else break;
  }

  return deals;
}

export async function GET() {
  if (!API_TOKEN) {
    return NextResponse.json({ error: "No API token" }, { status: 500 });
  }

  const [openDeals, wonDeals] = await Promise.all([
    fetchDeals("open"),
    fetchDeals("won"),
  ]);

  // Group open deals into display buckets
  const stages = DISPLAY_BUCKETS.map((bucket, i) => {
    const bucketDeals = openDeals.filter((d) => bucket.stageIds.includes(d.stage_id));
    return {
      id: i + 1,
      name: bucket.name,
      count: bucketDeals.length,
      value: bucketDeals.reduce((sum, d) => sum + d.value, 0),
      deals: bucketDeals,
    };
  });

  // Add Closed/Won
  stages.push({
    id: 99,
    name: "Closed/Won",
    count: wonDeals.length,
    value: wonDeals.reduce((sum, d) => sum + d.value, 0),
    deals: wonDeals,
  });

  return NextResponse.json({
    pipeline: "AccountCast",
    totalDeals: openDeals.length + wonDeals.length,
    totalValue: [...openDeals, ...wonDeals].reduce((sum, d) => sum + d.value, 0),
    stages,
  });
}

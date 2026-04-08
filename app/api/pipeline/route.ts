import { NextResponse } from "next/server";

const API_TOKEN = process.env.PIPEDRIVE_API_TOKEN;
const BASE_URL = "https://api.pipedrive.com/v1";
const ACCOUNTCAST_PIPELINE_ID = 5;

// AccountCast pipeline stages
const STAGE_NAMES: Record<number, string> = {
  26: "Prospecting",
  27: "Contacted",
  28: "Engaged",
  29: "Discovery Scheduled",
  30: "Discovery Completed",
  31: "Proposal",
  32: "Negotiation",
};

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

async function fetchAccountCastDeals(): Promise<Deal[]> {
  const deals: Deal[] = [];
  let start = 0;
  const limit = 100;

  while (true) {
    const params = new URLSearchParams({
      api_token: API_TOKEN!,
      start: String(start),
      limit: String(limit),
      status: "open",
    });

    const res = await fetch(
      `${BASE_URL}/pipelines/${ACCOUNTCAST_PIPELINE_ID}/deals?${params}`,
      { next: { revalidate: 300 } }
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

  const deals = await fetchAccountCastDeals();

  // Group by stage
  const stages = Object.entries(STAGE_NAMES).map(([id, name]) => {
    const stageDeals = deals.filter((d) => d.stage_id === Number(id));
    return {
      id: Number(id),
      name,
      count: stageDeals.length,
      value: stageDeals.reduce((sum, d) => sum + d.value, 0),
      deals: stageDeals,
    };
  });

  return NextResponse.json({
    pipeline: "AccountCast",
    totalDeals: deals.length,
    totalValue: deals.reduce((sum, d) => sum + d.value, 0),
    stages,
  });
}

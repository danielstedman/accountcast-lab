import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BASE_URL = "https://api.pipedrive.com/v1";
const ACCOUNTCAST_PIPELINE_ID = 5;

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

export async function GET() {
  const token = process.env.PIPEDRIVE_API_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "No API token configured" }, { status: 500 });
  }

  // Fetch all deals from AccountCast pipeline
  const allDeals: Deal[] = [];
  let start = 0;

  while (true) {
    const params = new URLSearchParams({
      api_token: token,
      start: String(start),
      limit: "100",
    });

    const res = await fetch(
      `${BASE_URL}/pipelines/${ACCOUNTCAST_PIPELINE_ID}/deals?${params}`,
      { cache: "no-store" }
    );

    if (!res.ok) break;
    const json = await res.json();
    if (!json.success) break;

    if (json.data) {
      for (const d of json.data) {
        allDeals.push({
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

  const openDeals = allDeals.filter((d) => d.status === "open");
  const wonDeals = allDeals.filter((d) => d.status === "won");

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

  stages.push({
    id: 99,
    name: "Closed/Won",
    count: wonDeals.length,
    value: wonDeals.reduce((sum, d) => sum + d.value, 0),
    deals: wonDeals,
  });

  return NextResponse.json({
    pipeline: "AccountCast",
    totalDeals: allDeals.length,
    totalValue: allDeals.reduce((sum, d) => sum + d.value, 0),
    stages,
    debug: {
      fetchedCount: allDeals.length,
      tokenPrefix: token.substring(0, 4),
      rawTest: await fetch(
        `${BASE_URL}/pipelines/${ACCOUNTCAST_PIPELINE_ID}/deals?api_token=${token}&limit=5`,
        { cache: "no-store" }
      ).then(r => r.json()).catch(e => ({ error: String(e) })),
    },
  });
}

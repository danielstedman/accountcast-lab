import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BASE_URL = "https://api.lemlist.com/api";

const ACCOUNTCAST_CAMPAIGNS: Record<string, string> = {
  cam_BNmQsFaGTLY3yXkXF: "AccountCast (Danny)",
  cam_mu9WWo7NqjpwXubWh: "Tier 1 AccountCast (Kyla)",
  cam_G222d33RL99aTLGto: "Scott's Customer Interview Push",
  cam_JL7ZR82ZcPauxQM5W: "AccountCast Launch",
};

interface CampaignStats {
  id: string;
  name: string;
  status: string;
  sent: number;
  opened: number;
  clicked: number;
  replied: number;
  bounced: number;
}

function authHeader(token: string) {
  return { Authorization: "Basic " + btoa(":" + token) };
}

async function fetchActivities(token: string, campaignId: string) {
  let sent = 0, opened = 0, clicked = 0, replied = 0, bounced = 0;
  let offset = 0;

  while (true) {
    const url = `${BASE_URL}/activities?campaignId=${campaignId}&limit=100&offset=${offset}`;
    const res = await fetch(url, {
      headers: authHeader(token),
      cache: "no-store",
    });

    if (!res.ok) break;

    let data: unknown[];
    try {
      data = await res.json();
    } catch {
      break;
    }

    if (!Array.isArray(data) || data.length === 0) break;

    for (const a of data as Record<string, string>[]) {
      switch (a.type) {
        case "emailsSent": sent++; break;
        case "emailsOpened": opened++; break;
        case "emailsClicked": clicked++; break;
        case "emailsReplied": replied++; break;
        case "emailsBounced": bounced++; break;
      }
    }

    offset += 100;
    if (data.length < 100) break;
  }

  return { sent, opened, clicked, replied, bounced };
}

export async function GET() {
  const token = process.env.LEMLIST_API_KEY;
  if (!token) {
    return NextResponse.json({ error: "No Lemlist API key configured" }, { status: 500 });
  }

  const campaigns: CampaignStats[] = [];

  for (const [id, name] of Object.entries(ACCOUNTCAST_CAMPAIGNS)) {
    let status = "unknown";
    try {
      const campRes = await fetch(`${BASE_URL}/campaigns/${id}`, {
        headers: authHeader(token),
        cache: "no-store",
      });
      if (campRes.ok) {
        const campData = await campRes.json();
        status = campData.status || "unknown";
      }
    } catch {
      // skip
    }

    const stats = await fetchActivities(token, id);

    campaigns.push({
      id,
      name,
      status,
      ...stats,
    });
  }

  return NextResponse.json({ campaigns });
}

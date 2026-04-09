import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const BASE_URL = "https://api.lemlist.com/api";

// Only track these AccountCast campaigns
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

async function fetchActivities(token: string, campaignId: string) {
  let sent = 0, opened = 0, clicked = 0, replied = 0, bounced = 0;
  let offset = 0;

  while (true) {
    const res = await fetch(
      `${BASE_URL}/activities?campaignId=${campaignId}&limit=100&offset=${offset}`,
      {
        headers: { Authorization: `Basic ${Buffer.from(`:${token}`).toString("base64")}` },
        cache: "no-store",
      }
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
    // Get campaign status
    const campRes = await fetch(`${BASE_URL}/campaigns/${id}`, {
      headers: { Authorization: `Basic ${Buffer.from(`:${token}`).toString("base64")}` },
      cache: "no-store",
    });

    let status = "unknown";
    if (campRes.ok) {
      const campData = await campRes.json();
      status = campData.status || "unknown";
    }

    // Get activity stats
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

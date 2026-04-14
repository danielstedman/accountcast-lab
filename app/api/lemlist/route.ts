import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

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

async function fetchLive(token: string): Promise<CampaignStats[] | null> {
  const campaigns: CampaignStats[] = [];

  for (const [id, name] of Object.entries(ACCOUNTCAST_CAMPAIGNS)) {
    let status = "unknown";
    try {
      const campRes = await fetch(`${BASE_URL}/campaigns/${id}`, {
        headers: authHeader(token),
        cache: "no-store",
      });
      if (!campRes.ok) return null; // Auth failed, fall back to file
      const campData = await campRes.json();
      status = campData.status || "unknown";
    } catch {
      return null;
    }

    // Fetch activities
    let sent = 0, opened = 0, clicked = 0, replied = 0, bounced = 0;
    let offset = 0;
    while (true) {
      try {
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
        offset += 100;
        if (data.length < 100) break;
      } catch {
        break;
      }
    }

    campaigns.push({ id, name, status, sent, opened, clicked, replied, bounced });
  }

  return campaigns;
}

function loadFromFile(): CampaignStats[] | null {
  try {
    const filePath = join(process.cwd(), "data", "lemlist-campaigns.json");
    const raw = readFileSync(filePath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function GET() {
  const token = process.env.LEMLIST_API_KEY;

  // Try live API first
  if (token) {
    const live = await fetchLive(token);
    if (live) {
      return NextResponse.json({ campaigns: live, source: "live" });
    }
  }

  // Fall back to pre-computed file
  const file = loadFromFile();
  if (file) {
    return NextResponse.json({ campaigns: file, source: "snapshot" });
  }

  return NextResponse.json({ error: "No Lemlist data available", campaigns: [] }, { status: 200 });
}

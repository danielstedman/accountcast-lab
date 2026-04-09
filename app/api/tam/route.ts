import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

const LEMLIST_CAMPAIGNS: Record<string, string> = {
  cam_BNmQsFaGTLY3yXkXF: "AccountCast (Danny)",
  cam_mu9WWo7NqjpwXubWh: "Tier 1 (Kyla)",
  cam_G222d33RL99aTLGto: "Scott Interview Push",
  cam_JL7ZR82ZcPauxQM5W: "AccountCast Launch",
};

function authHeader(token: string) {
  return { Authorization: "Basic " + btoa(":" + token) };
}

interface TamAccount {
  company: string;
  domain: string;
  country: string;
  size: string;
  revenue: string;
  industry: string;
  channels: string[];
}

export async function GET() {
  const lemlistKey = process.env.LEMLIST_API_KEY;
  const pipedriveKey = process.env.PIPEDRIVE_API_TOKEN;

  // Read TAM file
  const tamPath = join(process.cwd(), "data", "tam.xlsx");
  let tamData: Record<string, string>[];
  try {
    const buf = readFileSync(tamPath);
    const wb = XLSX.read(buf);
    tamData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
  } catch {
    return NextResponse.json({ error: "Could not read TAM file" }, { status: 500 });
  }

  const tamByDomain: Record<string, TamAccount> = {};
  for (const row of tamData) {
    const domain = String(row["Business Domain"] || "").toLowerCase();
    if (!domain) continue;
    tamByDomain[domain] = {
      company: String(row["Company Name"] || ""),
      domain,
      country: String(row["HQ Country"] || ""),
      size: String(row["Company Size"] || ""),
      revenue: String(row["Company Revenue"] || ""),
      industry: String(row["Industry"] || ""),
      channels: [],
    };
  }

  // Match Lemlist leads against TAM
  if (lemlistKey) {
    for (const [campId, campName] of Object.entries(LEMLIST_CAMPAIGNS)) {
      let offset = 0;
      const seenDomains = new Set<string>();

      while (true) {
        try {
          const res = await fetch(
            `https://api.lemlist.com/api/activities?campaignId=${campId}&limit=100&offset=${offset}`,
            { headers: authHeader(lemlistKey), cache: "no-store" }
          );
          if (!res.ok) break;
          const data = await res.json();
          if (!Array.isArray(data) || data.length === 0) break;

          for (const a of data) {
            if (a.leadEmail) {
              const domain = a.leadEmail.split("@")[1]?.toLowerCase();
              if (domain && tamByDomain[domain] && !seenDomains.has(domain)) {
                seenDomains.add(domain);
                if (!tamByDomain[domain].channels.includes("Lemlist: " + campName)) {
                  tamByDomain[domain].channels.push("Lemlist: " + campName);
                }
              }
            }
          }

          offset += 100;
          if (data.length < 100) break;
        } catch {
          break;
        }
      }
    }
  }

  // Match Pipedrive deals against TAM
  if (pipedriveKey) {
    try {
      const res = await fetch(
        `https://api.pipedrive.com/v1/pipelines/5/deals?api_token=${pipedriveKey}&limit=100`,
        { cache: "no-store" }
      );
      const json = await res.json();
      if (json.success && json.data) {
        for (const deal of json.data) {
          const orgName = String(deal.org_name || "").toLowerCase();
          const match = Object.values(tamByDomain).find(
            (t) => t.company.toLowerCase() === orgName
          );
          if (match && !match.channels.includes("Pipedrive: In Pipeline")) {
            match.channels.push("Pipedrive: In Pipeline");
          }
        }
      }
    } catch {
      // skip
    }
  }

  // Build summary
  const allAccounts = Object.values(tamByDomain);
  const touched = allAccounts.filter((a) => a.channels.length > 0);
  const multiChannel = allAccounts.filter((a) => a.channels.length > 1);
  const untouched = allAccounts.filter((a) => a.channels.length === 0);

  return NextResponse.json({
    total: allAccounts.length,
    touched: touched.length,
    untouched: untouched.length,
    multiChannel: multiChannel.length,
    coverage: Math.round((touched.length / allAccounts.length) * 1000) / 10,
    touchedAccounts: touched
      .sort((a, b) => b.channels.length - a.channels.length)
      .map((a) => ({
        company: a.company,
        domain: a.domain,
        industry: a.industry,
        size: a.size,
        channels: a.channels,
        touchCount: a.channels.length,
      })),
  });
}

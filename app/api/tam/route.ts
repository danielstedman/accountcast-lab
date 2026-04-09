import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export const dynamic = "force-dynamic";

interface TouchedAccount {
  company: string;
  domain: string;
  industry: string;
  size: string;
  channels: string[];
  touchCount: number;
}

export async function GET() {
  // Read pre-computed TAM matches
  const matchesPath = join(process.cwd(), "data", "tam-matches.json");
  let touchedAccounts: TouchedAccount[];
  try {
    const raw = readFileSync(matchesPath, "utf-8");
    touchedAccounts = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "TAM matches file not found" }, { status: 500 });
  }

  const total = 2797; // from TAM xlsx
  const touched = touchedAccounts.length;
  const multiChannel = touchedAccounts.filter((a) => a.touchCount > 1).length;

  return NextResponse.json({
    total,
    touched,
    untouched: total - touched,
    multiChannel,
    coverage: Math.round((touched / total) * 1000) / 10,
    touchedAccounts,
  });
}

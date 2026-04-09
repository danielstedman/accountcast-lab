import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export const dynamic = "force-dynamic";

const KV_KEY = "proposals-state";

function getRedis() {
  const url = process.env.accountcast_dash_KV_REST_API_URL;
  const token = process.env.accountcast_dash_KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export interface ProposalsState {
  order: string[];
  statuses: Record<string, "approved" | "postponed" | "cancelled" | null>;
  dates: Record<string, string>;
}

export async function GET() {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
  }

  const state = await redis.get<ProposalsState>(KV_KEY);
  return NextResponse.json(state || null);
}

export async function POST(request: Request) {
  const redis = getRedis();
  if (!redis) {
    return NextResponse.json({ error: "Redis not configured" }, { status: 500 });
  }

  const state: ProposalsState = await request.json();
  await redis.set(KV_KEY, state);
  return NextResponse.json({ ok: true });
}

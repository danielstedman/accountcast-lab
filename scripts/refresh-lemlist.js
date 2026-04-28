#!/usr/bin/env node

/**
 * Refresh Lemlist campaign snapshot.
 * Discovers all Lemlist campaigns created on/after MIN_CAMPAIGN_DATE,
 * fetches per-campaign activity stats, and writes data/lemlist-campaigns.json.
 *
 * Run: node scripts/refresh-lemlist.js
 * Then commit + push to deploy fresh fallback data.
 */

const fs = require("fs");
const path = require("path");

const API_KEY = process.env.LEMLIST_API_KEY || "52b72cd89982096b50172eca646f74ef";
const BASE_URL = "https://api.lemlist.com/api";
const MIN_CAMPAIGN_DATE = "2026-02-01";

function authHeader() {
  return { Authorization: "Basic " + Buffer.from(":" + API_KEY).toString("base64") };
}

async function listAllCampaigns() {
  const all = [];
  let offset = 0;
  while (true) {
    const res = await fetch(`${BASE_URL}/campaigns?limit=100&offset=${offset}`, {
      headers: authHeader(),
    });
    if (!res.ok) {
      console.error(`  /campaigns error: ${res.status} ${res.statusText}`);
      return null;
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    if (data.length < 100) break;
    offset += 100;
  }
  return all;
}

async function fetchActivities(campaignId) {
  let sent = 0, opened = 0, clicked = 0, replied = 0, bounced = 0;
  let offset = 0;

  while (true) {
    const res = await fetch(
      `${BASE_URL}/activities?campaignId=${campaignId}&limit=100&offset=${offset}`,
      { headers: authHeader() }
    );
    if (!res.ok) {
      console.error(`  activities error: ${res.status} ${res.statusText}`);
      break;
    }
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

async function main() {
  console.log("Discovering Lemlist campaigns...");
  const all = await listAllCampaigns();
  if (!all) {
    console.error("Failed to list campaigns. Aborting.");
    process.exit(1);
  }

  const minMs = new Date(MIN_CAMPAIGN_DATE).getTime();
  const recent = all.filter((c) => {
    const t = c.createdAt ? new Date(c.createdAt).getTime() : 0;
    return t >= minMs;
  });
  console.log(`Found ${recent.length} campaigns on/after ${MIN_CAMPAIGN_DATE}\n`);

  const results = [];
  for (const c of recent) {
    process.stdout.write(`  ${c.name}...`);
    const stats = await fetchActivities(c._id);
    results.push({
      id: c._id,
      name: c.name,
      status: c.status || "unknown",
      createdAt: c.createdAt,
      ...stats,
    });
    console.log(` sent=${stats.sent} opened=${stats.opened} replied=${stats.replied}`);
  }

  const outPath = path.join(__dirname, "..", "data", "lemlist-campaigns.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nSaved ${results.length} campaigns to ${outPath}`);
  console.log("Now commit + push to deploy fresh data.");
}

main().catch(console.error);

#!/usr/bin/env node

/**
 * Refresh Lemlist campaign data locally and save to data/lemlist-campaigns.json
 * Run: node scripts/refresh-lemlist.js
 * Then commit + push to deploy fresh data.
 */

const fs = require("fs");
const path = require("path");

const API_KEY = process.env.LEMLIST_API_KEY || "52b72cd89982096b50172eca646f74ef";
const BASE_URL = "https://api.lemlist.com/api";

const CAMPAIGNS = {
  cam_BNmQsFaGTLY3yXkXF: "AccountCast (Danny)",
  cam_mu9WWo7NqjpwXubWh: "Tier 1 AccountCast (Kyla)",
  cam_G222d33RL99aTLGto: "Scott's Customer Interview Push",
  cam_JL7ZR82ZcPauxQM5W: "AccountCast Launch",
};

function authHeader() {
  return { Authorization: "Basic " + Buffer.from(":" + API_KEY).toString("base64") };
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
      console.error(`  API error: ${res.status} ${res.statusText}`);
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
    offset += 100;
    if (data.length < 100) break;
  }

  return { sent, opened, clicked, replied, bounced };
}

async function main() {
  console.log("Refreshing Lemlist data...\n");
  const results = [];

  for (const [id, name] of Object.entries(CAMPAIGNS)) {
    process.stdout.write(`  ${name}...`);

    let status = "unknown";
    try {
      const res = await fetch(`${BASE_URL}/campaigns/${id}`, { headers: authHeader() });
      if (res.ok) {
        const data = await res.json();
        status = data.status || "unknown";
      }
    } catch {}

    const stats = await fetchActivities(id);
    results.push({ id, name, status, ...stats });
    console.log(` sent=${stats.sent} opened=${stats.opened} replied=${stats.replied}`);
  }

  const outPath = path.join(__dirname, "..", "data", "lemlist-campaigns.json");
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nSaved to ${outPath}`);
  console.log("Now commit + push to deploy fresh data.");
}

main().catch(console.error);

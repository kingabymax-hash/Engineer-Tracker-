import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.AIRTABLE_API_KEY || "";
  const baseId = process.env.AIRTABLE_BASE_ID || "";
  const googleKey = process.env.GOOGLE_API_KEY || "";

  // Test Airtable directly
  let airtableStatus = "not tested";
  let airtableBody = "";
  try {
    const res = await fetch(
      `https://api.airtable.com/v0/${baseId}/tbl85KKWBIqjNSXsY?maxRecords=1`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      }
    );
    airtableStatus = `${res.status} ${res.statusText}`;
    airtableBody = await res.text();
  } catch (e: unknown) {
    airtableStatus = "fetch error";
    airtableBody = e instanceof Error ? e.message : String(e);
  }

  return NextResponse.json({
    env: {
      AIRTABLE_API_KEY_length: apiKey.length,
      AIRTABLE_API_KEY_prefix: apiKey.substring(0, 10),
      AIRTABLE_API_KEY_suffix: apiKey.substring(apiKey.length - 6),
      AIRTABLE_BASE_ID: baseId,
      GOOGLE_API_KEY_present: googleKey.length > 0,
    },
    airtable_test: {
      status: airtableStatus,
      body: airtableBody.substring(0, 500),
    },
  });
}

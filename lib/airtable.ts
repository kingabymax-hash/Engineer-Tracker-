const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || "";
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || "";
const AIRTABLE_TABLE_ID = "tbl85KKWBIqjNSXsY";

// Debug: log key prefix to verify env var is loaded
console.log("AIRTABLE_API_KEY loaded:", AIRTABLE_API_KEY ? AIRTABLE_API_KEY.substring(0, 10) + "..." : "MISSING");
console.log("AIRTABLE_BASE_ID loaded:", AIRTABLE_BASE_ID || "MISSING");

const BASE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_ID}`;

const headers = {
  Authorization: `Bearer ${AIRTABLE_API_KEY}`,
  "Content-Type": "application/json",
};

export interface FieldLogRecord {
  id: string;
  fields: {
    "Record ID"?: number;
    "Client Name"?: string;
    "Date Logged"?: string;
    Type?: string;
    Priority?: string;
    Summary?: string;
    "Full Description"?: string;
    "Raw Transcript"?: string;
    Status?: string;
    "Assigned To"?: string;
    "Completed Date"?: string;
  };
}

export async function getAllRecords(): Promise<FieldLogRecord[]> {
  const records: FieldLogRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(BASE_URL);
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url.toString(), { headers, cache: "no-store" });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Airtable GET failed: ${err}`);
    }
    const data = await res.json();
    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  return records;
}

export async function createRecord(fields: Record<string, unknown>): Promise<{ id: string }> {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers,
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Airtable POST error — status:", res.status, "body:", err);
    console.error("Airtable POST request fields:", JSON.stringify(fields, null, 2));
    throw new Error(`Airtable POST failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return { id: data.id };
}

export async function updateRecord(
  recordId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const res = await fetch(`${BASE_URL}/${recordId}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable PATCH failed: ${err}`);
  }
}

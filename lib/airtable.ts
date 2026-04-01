const AIRTABLE_TABLE_ID = "tbl85KKWBIqjNSXsY";

function getBaseUrl() {
  const baseId = process.env.AIRTABLE_BASE_ID || "";
  return `https://api.airtable.com/v0/${baseId}/${AIRTABLE_TABLE_ID}`;
}

function getHeaders() {
  const apiKey = (process.env.AIRTABLE_API_KEY || "").trim();
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

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
    const url = new URL(getBaseUrl());
    url.searchParams.set("pageSize", "100");
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url.toString(), { headers: getHeaders(), cache: "no-store" });
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
  const res = await fetch(getBaseUrl(), {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Airtable POST error — status:", res.status, "body:", err);
    throw new Error(`Airtable POST failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return { id: data.id };
}

export async function updateRecord(
  recordId: string,
  fields: Record<string, unknown>
): Promise<void> {
  const res = await fetch(`${getBaseUrl()}/${recordId}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable PATCH failed: ${err}`);
  }
}

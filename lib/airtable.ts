const FIELDLOG_TABLE_ID = "tbl85KKWBIqjNSXsY";
const MEETINGLOG_TABLE_NAME = "MeetingLog";

function getBaseUrl(table: string) {
  const baseId = process.env.AIRTABLE_BASE_ID || "";
  return `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`;
}

function getHeaders() {
  const apiKey = (process.env.AIRTABLE_API_KEY || "").trim();
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

// --- FieldLog (Client Issues) ---

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
    const url = new URL(getBaseUrl(FIELDLOG_TABLE_ID));
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
  const res = await fetch(getBaseUrl(FIELDLOG_TABLE_ID), {
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
  const res = await fetch(`${getBaseUrl(FIELDLOG_TABLE_ID)}/${recordId}`, {
    method: "PATCH",
    headers: getHeaders(),
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Airtable PATCH failed: ${err}`);
  }
}

// --- MeetingLog ---

export interface MeetingLogRecord {
  id: string;
  fields: {
    "Meeting ID"?: number;
    Date?: string;
    Duration?: string;
    Attendees?: string;
    "Meeting Title"?: string;
    "Key Notes"?: string;
    "To Do List"?: string;
    "Raw Transcript"?: string;
  };
}

export async function getAllMeetingRecords(): Promise<MeetingLogRecord[]> {
  const records: MeetingLogRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(getBaseUrl(MEETINGLOG_TABLE_NAME));
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("sort[0][field]", "Date");
    url.searchParams.set("sort[0][direction]", "desc");
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url.toString(), { headers: getHeaders(), cache: "no-store" });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Airtable GET (MeetingLog) failed: ${err}`);
    }
    const data = await res.json();
    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  return records;
}

export async function createMeetingRecord(fields: Record<string, unknown>): Promise<{ id: string }> {
  const res = await fetch(getBaseUrl(MEETINGLOG_TABLE_NAME), {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({ fields }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Airtable POST (MeetingLog) error — status:", res.status, "body:", err);
    throw new Error(`Airtable POST failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return { id: data.id };
}

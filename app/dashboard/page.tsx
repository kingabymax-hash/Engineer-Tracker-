"use client";

import { useState, useEffect, useCallback } from "react";

interface FieldLogRecord {
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

const STATUS_OPTIONS = ["Open", "In Progress", "Completed"];
const TYPE_OPTIONS = ["All", "Bug", "Change Request", "Upgrade", "Complaint", "Other"];
const PRIORITY_OPTIONS = ["All", "Low", "Medium", "High", "Critical"];

const priorityColor: Record<string, string> = {
  Low: "bg-gray-100 text-gray-700",
  Medium: "bg-blue-100 text-blue-700",
  High: "bg-orange-100 text-orange-700",
  Critical: "bg-red-100 text-red-700",
};

const statusColor: Record<string, string> = {
  Open: "bg-yellow-100 text-yellow-800",
  "In Progress": "bg-blue-100 text-blue-800",
  Completed: "bg-green-100 text-green-800",
};

export default function Dashboard() {
  const [records, setRecords] = useState<FieldLogRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterType, setFilterType] = useState("All");
  const [filterPriority, setFilterPriority] = useState("All");

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch("/api/records");
      const data = await res.json();
      setRecords(data.records || []);
    } catch (err) {
      console.error("Failed to fetch records:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const updateField = async (recordId: string, fields: Record<string, unknown>) => {
    try {
      await fetch("/api/records", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId, fields }),
      });
      // Optimistically update local state
      setRecords((prev) =>
        prev.map((r) =>
          r.id === recordId
            ? {
                ...r,
                fields: {
                  ...r.fields,
                  ...fields,
                  ...(fields.Status === "Completed"
                    ? { "Completed Date": new Date().toISOString().split("T")[0] }
                    : {}),
                } as FieldLogRecord["fields"],
              }
            : r
        )
      );
    } catch (err) {
      console.error("Failed to update:", err);
    }
  };

  const filtered = records.filter((r) => {
    if (filterStatus !== "All" && r.fields.Status !== filterStatus) return false;
    if (filterType !== "All" && r.fields.Type !== filterType) return false;
    if (filterPriority !== "All" && r.fields.Priority !== filterPriority) return false;
    return true;
  });

  const counts = {
    Open: records.filter((r) => r.fields.Status === "Open").length,
    "In Progress": records.filter((r) => r.fields.Status === "In Progress").length,
    Completed: records.filter((r) => r.fields.Status === "Completed").length,
  };

  return (
    <div className="min-h-screen flex bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex-shrink-0 hidden md:flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold">FieldLog</h1>
          <p className="text-gray-400 text-sm mt-1">Engineer Dashboard</p>
        </div>
        <nav className="px-4 space-y-1 flex-1">
          <a href="/" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 text-sm transition-colors">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
            Record View
          </a>
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-800 text-white text-sm">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Dashboard
          </div>
        </nav>
        <div className="p-4 text-xs text-gray-500">
          {records.length} total records
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {/* Mobile header */}
        <div className="md:hidden bg-gray-900 text-white p-4 flex items-center justify-between">
          <h1 className="font-bold">FieldLog</h1>
          <a href="/" className="text-sm text-gray-400">Record</a>
        </div>

        <div className="p-4 md:p-8 max-w-7xl mx-auto">
          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {(["Open", "In Progress", "Completed"] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(filterStatus === status ? "All" : status)}
                className={`rounded-xl p-4 text-left transition-all ${
                  filterStatus === status ? "ring-2 ring-blue-500" : ""
                } ${
                  status === "Open"
                    ? "bg-yellow-50"
                    : status === "In Progress"
                    ? "bg-blue-50"
                    : "bg-green-50"
                }`}
              >
                <p className="text-2xl font-bold">{counts[status]}</p>
                <p className="text-sm text-gray-600">{status}</p>
              </button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              <option value="All">All Statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {TYPE_OPTIONS.map((t) => (
                <option key={t} value={t}>{t === "All" ? "All Types" : t}</option>
              ))}
            </select>
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
            >
              {PRIORITY_OPTIONS.map((p) => (
                <option key={p} value={p}>{p === "All" ? "All Priorities" : p}</option>
              ))}
            </select>
            {(filterStatus !== "All" || filterType !== "All" || filterPriority !== "All") && (
              <button
                onClick={() => { setFilterStatus("All"); setFilterType("All"); setFilterPriority("All"); }}
                className="text-sm text-gray-500 hover:text-gray-700 underline"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <p className="text-lg">No records found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="text-left px-4 py-3 font-medium text-gray-500">#</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Client</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 hidden sm:table-cell">Date</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Type</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Priority</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 hidden md:table-cell">Summary</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500">Status</th>
                      <th className="text-left px-4 py-3 font-medium text-gray-500 hidden lg:table-cell">Assigned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((record) => (
                      <RecordRow
                        key={record.id}
                        record={record}
                        expanded={expandedId === record.id}
                        onToggle={() => setExpandedId(expandedId === record.id ? null : record.id)}
                        onUpdateField={updateField}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function RecordRow({
  record,
  expanded,
  onToggle,
  onUpdateField,
}: {
  record: FieldLogRecord;
  expanded: boolean;
  onToggle: () => void;
  onUpdateField: (id: string, fields: Record<string, unknown>) => void;
}) {
  const f = record.fields;

  const ASSIGNED_OPTIONS = ["", "Hasan ", "George ", "Max ", "Brett"];

  return (
    <>
      <tr
        onClick={onToggle}
        className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors"
      >
        <td className="px-4 py-3 text-gray-400">{f["Record ID"] || "—"}</td>
        <td className="px-4 py-3 font-medium">{f["Client Name"] || "—"}</td>
        <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{f["Date Logged"] || "—"}</td>
        <td className="px-4 py-3">
          <span className="inline-block bg-gray-100 text-gray-700 rounded-full px-2.5 py-0.5 text-xs font-medium">
            {f.Type || "—"}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${priorityColor[f.Priority || ""] || "bg-gray-100 text-gray-700"}`}>
            {f.Priority || "—"}
          </span>
        </td>
        <td className="px-4 py-3 text-gray-600 hidden md:table-cell max-w-xs truncate">
          {f.Summary || "—"}
        </td>
        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
          <select
            value={f.Status || "Open"}
            onChange={(e) => onUpdateField(record.id, { Status: e.target.value })}
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium border-0 cursor-pointer ${statusColor[f.Status || ""] || "bg-gray-100"}`}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </td>
        <td className="px-4 py-3 hidden lg:table-cell" onClick={(e) => e.stopPropagation()}>
          <select
            value={f["Assigned To"] || ""}
            onChange={(e) => onUpdateField(record.id, { "Assigned To": e.target.value || null })}
            className="rounded-full px-2.5 py-0.5 text-xs font-medium border-0 cursor-pointer bg-gray-100 text-gray-700"
          >
            <option value="">Unassigned</option>
            {ASSIGNED_OPTIONS.filter(Boolean).map((name) => (
              <option key={name} value={name}>{name.trim()}</option>
            ))}
          </select>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan={8} className="px-4 py-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Full Description</h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{f["Full Description"] || "No description"}</p>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">Raw Transcript</h4>
                <p className="text-sm text-gray-500 whitespace-pre-wrap italic">{f["Raw Transcript"] || "No transcript"}</p>
              </div>
            </div>
            {f["Completed Date"] && (
              <p className="text-xs text-gray-400 mt-3">Completed: {f["Completed Date"]}</p>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

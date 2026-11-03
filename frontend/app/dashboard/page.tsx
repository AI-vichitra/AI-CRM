"use client";

import React, { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import DashboardShell from "../../components/dashboard/DashboardShell";
import MetricCard from "../../components/dashboard/MetricCard";
import CRMTable from "../../components/dashboard/CRMTable";
import GraphWidget from "../../components/dashboard/GraphWidget";
import GraphBuilder from "../../components/dashboard/GraphBuilder";
import EmptyState from "../../components/dashboard/EmptyState";
import LeadFormModal from "../../components/dashboard/LeadFormModal";
import ActionConversationModal from "../../components/dashboard/ActionConversationModal";
import RevenueAnalysisWidget from "../../components/dashboard/RevenueAnalysisWidget";
import LeadsTrendWidget from "../../components/dashboard/LeadsTrendWidget";
import LeadsByChannelWidget from "../../components/dashboard/LeadsByChannelWidget";
import DateRangeFilter, { DateFilterValue } from "../../components/dashboard/DateRangeFilter";
import DataPlatformView from "../../components/dashboard/DataPlatformView";
import ProposalTrackerView from "../../components/dashboard/ProposalTrackerView";
import FollowUpDashboardView from "../../components/dashboard/FollowUpDashboardView";
import TenderDashboardView from "../../components/dashboard/TenderDashboardView";
import { api } from "../../lib/api";
import { SheetData, DashboardSummary, GraphConfig } from "../../lib/types";
import { toast } from "sonner";
import { RefreshCw, Search, Bell, X, AlertCircle, Eye, EyeOff } from "lucide-react";

// Helper to parse dates like DD/MM/YYYY, DD-MM-YYYY, or YYYY-MM-DD
const parseDate = (dateVal: any): Date | null => {
  if (!dateVal) return null;
  const dateStr = String(dateVal).trim();
  if (!dateStr || dateStr === "—" || dateStr.toLowerCase() === "placeholder") return null;

  // Handle Excel/Sheets serial numbers (e.g. 46216)
  const numVal = Number(dateStr);
  if (!isNaN(numVal) && numVal >= 30000 && numVal <= 65000) {
    const utcDate = new Date((numVal - 25569) * 86400 * 1000);
    return new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
  }

  const datePart = dateStr.split(/\s+/)[0];
  const parts = datePart.split(/[-/.]/);
  if (parts.length === 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);

    if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
      // YYYY-MM-DD
      if (parts[0].length === 4) {
        return new Date(p0, p1 - 1, p2);
      }
      // DD-MM-YYYY or DD/MM/YYYY
      if (parts[2].length === 4) {
        if (p0 <= 12 && p1 > 12) {
          return new Date(p2, p0 - 1, p1);
        }
        return new Date(p2, p1 - 1, p0);
      }
      // DD-MM-YY or DD/MM/YY
      if (parts[2].length === 2) {
        const yr = p2 < 50 ? 2000 + p2 : 1900 + p2;
        if (p0 <= 12 && p1 > 12) {
          return new Date(yr, p0 - 1, p1);
        }
        return new Date(yr, p1 - 1, p0);
      }
    }
  }

  const parsed = Date.parse(dateStr);
  return isNaN(parsed) ? null : new Date(parsed);
};

// Parses revenue-like cell values, including expressions like "10,00,000 + 27,00,000 (4,50,000 X 6)"
const parseRevenueValue = (raw: any): number => {
  if (raw === undefined || raw === null) return 0;
  const str = String(raw).trim();
  if (!str || str === "—" || str === "-") return 0;

  const basePart = str.split("(")[0].trim();
  if (basePart.includes("+")) {
    return basePart.split("+").reduce((acc, part) => {
      const clean = part.replace(/[^0-9.-]/g, "").trim();
      const num = parseFloat(clean);
      return acc + (isNaN(num) ? 0 : num);
    }, 0);
  }

  const clean = basePart.replace(/[^0-9.-]/g, "").trim();
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
};

const findRevenueHeader = (headers: string[] | undefined): string => {
  if (!headers) return "";
  return headers.find(h => {
    const hl = h.toLowerCase();
    return hl.includes("estimated") || hl.includes("est") || hl.includes("revenue") || hl.includes("estimation");
  }) || headers.find(h => {
    const hl = h.toLowerCase();
    return hl.includes("value") || hl.includes("amount") || hl.includes("deal size");
  }) || "";
};

// Date-range presets shared by the Dashboard's "Revenue" and "Lead by Channel" charts
const RANGE_PRESETS: Record<string, { count: number; offset: number }> = {
  this_month: { count: 1, offset: 0 },
  last_month: { count: 1, offset: 1 },
  "3": { count: 3, offset: 0 },
  "6": { count: 6, offset: 0 },
  "12": { count: 12, offset: 0 },
};

const getRangeMonths = (rangeKey: string): { label: string; year: number; month: number }[] => {
  const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const preset = RANGE_PRESETS[rangeKey] || RANGE_PRESETS["6"];
  const now = new Date();
  const endMonth = new Date(now.getFullYear(), now.getMonth() - preset.offset, 1);
  return Array.from({ length: preset.count }, (_, i) => {
    const d = new Date(endMonth.getFullYear(), endMonth.getMonth() - (preset.count - 1 - i), 1);
    return { label: MONTHS_SHORT[d.getMonth()], year: d.getFullYear(), month: d.getMonth() };
  });
};

// Groups a set of Dashboard cards/widgets under a labeled, visually distinct section
function DashboardSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 dark:border-[rgba(255,255,255,0.06)] bg-gray-50/60 dark:bg-white/[0.02] p-5">
      <h3 className="text-xs font-semibold text-gray-500 dark:text-[#888899] tracking-wide uppercase font-mono mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}

// Resolves a DateFilterValue preset (or custom range) into an actual [start, end] Date range.
// Returns null for "all" (no filtering).
const getPresetRange = (filter: DateFilterValue): { start: Date; end: Date } | null => {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  if (filter.preset === "today") {
    return { start: startOfDay(now), end: endOfDay(now) };
  }
  if (filter.preset === "this_week") {
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffToMonday);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6);
    return { start: startOfDay(start), end: endOfDay(end) };
  }
  if (filter.preset === "this_month") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: startOfDay(start), end: endOfDay(end) };
  }
  if (filter.preset === "last_month") {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return { start: startOfDay(start), end: endOfDay(end) };
  }
  if (filter.preset === "this_year") {
    const start = new Date(now.getFullYear(), 0, 1);
    const end = new Date(now.getFullYear(), 11, 31);
    return { start: startOfDay(start), end: endOfDay(end) };
  }
  if (filter.preset === "custom" && filter.startDate && filter.endDate) {
    const s = new Date(`${filter.startDate}T00:00:00`);
    const e = new Date(`${filter.endDate}T23:59:59.999`);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return null;
    return { start: s, end: e };
  }
  return null;
};

// Helper function to check if a date string is today's date
const isToday = (dateVal: any): boolean => {
  const d = parseDate(dateVal);
  if (!d) return false;
  const today = new Date();
  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
};



export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen w-screen items-center justify-center bg-[#0A0A0F] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="relative flex h-10 w-10">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-10 w-10 bg-emerald-500 flex items-center justify-center">
              <svg className="w-5 h-5 text-black" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" strokeDasharray="3 3" />
                <circle cx="12" cy="12" r="2" fill="currentColor" />
              </svg>
            </span>
          </div>
          <span className="text-xs font-semibold tracking-[0.2em] uppercase text-gray-400">Loading Workspace...</span>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") || "dashboard";
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [sheetData, setSheetData] = useState<SheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showAlertPanel, setShowAlertPanel] = useState(false);
  const [dateFilter, setDateFilter] = useState<DateFilterValue>({ preset: "this_month", startDate: "", endDate: "" });
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedKpiTab, setSelectedKpiTab] = useState<string>("Total Leads");

  // Source-breakdown data for the Dashboard cards (Inbound / Outbound / PR / Govt)
  const [internalLeadsData, setInternalLeadsData] = useState<SheetData | null>(null);
  const [prLeadsData, setPrLeadsData] = useState<SheetData | null>(null);
  const [leadsTrendMonths, setLeadsTrendMonths] = useState<string>("6");
  const [leadsByChannelMonths, setLeadsByChannelMonths] = useState<string>("6");

  // Current logged in user
  const [currentUser, setCurrentUser] = useState<{ name?: string; email?: string } | null>(null);

  // Lead modal states
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Record<string, any> | null>(null);
  const [modalTitle, setModalTitle] = useState("Add New Lead");

  // Action / Conversation modal states
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [selectedActionLead, setSelectedActionLead] = useState<Record<string, any> | null>(null);

  async function loadData(showToast = false, bypassCache = false) {
    try {
      // Target range based on tab: "Internal Leads" for internal leads, "PR Leads" for PR leads, "Active Leads" for Active Leads & Tender
      const targetTabRange = tab === "internal_leads" ? "Internal Leads" : (tab === "pr_leads" ? "PR Leads" : "Active Leads");

      const [sum, data, authStatus, internalData, prData] = await Promise.all([
        api.getDashboardSummary(bypassCache),
        api.getSheetData(bypassCache, targetTabRange),
        api.getAuthStatus().catch(() => null),
        tab === "dashboard" ? api.getSheetData(bypassCache, "Internal Leads").catch(() => null) : Promise.resolve(null),
        tab === "dashboard" ? api.getSheetData(bypassCache, "PR Leads").catch(() => null) : Promise.resolve(null),
      ]);
      setSummary(sum);
      setSheetData(data);
      if (tab === "dashboard") {
        setInternalLeadsData(internalData);
        setPrLeadsData(prData);
      }
      if (authStatus?.authenticated) {
        let cleanName = authStatus.name || "";
        if (!cleanName && authStatus.email) {
          const prefix = authStatus.email.split("@")[0].replace(/[._]/g, " ");
          cleanName = prefix.charAt(0).toUpperCase() + prefix.slice(1);
        }
        setCurrentUser({ name: cleanName, email: authStatus.email });
      }
      if (showToast) {
        toast.success("CRM dashboard synchronized");
      }
      
      // Check if there are due leads and open the panel automatically
      if (data && data.rows) {
        const deadlineHeader = data.headers.find(h => {
          const hl = h.toLowerCase();
          return hl.includes("deadline") || hl.includes("due");
        }) || "";
        if (deadlineHeader) {
          const due = data.rows.filter(row => isToday(row[deadlineHeader]));
          if (due.length > 0) {
            setShowAlertPanel(true);
          }
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to load CRM data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    setSelectedKpiTab("Total Leads");
    loadData(false, false);
  }, [tab]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData(true, true);
  };

  const handleLoadMock = async () => {
    setLoading(true);
    try {
      await api.updateConfig({
        sheet_url: "mock",
        sheet_range: "Sheet1"
      });
      await loadData();
      toast.success("Synchronized with Mock CRM Playground data");
    } catch (err: any) {
      toast.error("Failed to load mock data");
      setLoading(false);
    }
  };

  const handleSaveTableConfig = async (visible: string[], order: string[]) => {
    if (summary) {
      setSummary({
        ...summary,
        visible_columns: visible,
        column_order: order,
      });
    }
    await api.updateConfig({
      visible_columns: visible,
      column_order: order,
    });
  };

  const handleAddGraph = async (newGraph: GraphConfig) => {
    if (!summary) return;
    const updatedGraphs = [...(summary.graphs || []), newGraph];
    setSummary({
      ...summary,
      graphs: updatedGraphs,
    });
    await api.updateConfig({
      graphs: updatedGraphs,
    });
  };

  const handleDeleteGraph = async (id: string) => {
    if (!summary) return;
    const updatedGraphs = (summary.graphs || []).filter((g) => g.id !== id);
    setSummary({
      ...summary,
      graphs: updatedGraphs,
    });
    await api.updateConfig({
      graphs: updatedGraphs,
    });
  };

  const handleAddLead = () => {
    setSelectedLead(null);
    setModalTitle("Add New Lead");
    setIsLeadModalOpen(true);
  };

  const handleEditLead = (row: Record<string, any>) => {
    setSelectedActionLead(row);
    setIsActionModalOpen(true);
  };

  const handleDeleteLead = async (row: Record<string, any>) => {
    const rowNum = row._row_num;
    if (!rowNum) {
      toast.error("Invalid lead row index");
      return;
    }
    const confirmed = window.confirm(
      "Are you sure you want to delete this lead? This will permanently remove the row from the Google Sheet."
    );
    if (!confirmed) return;

    try {
      setRefreshing(true);
      const targetTabRange = tab === "internal_leads" 
        ? "Internal Leads" 
        : tab === "pr_leads"
        ? "PR Leads"
        : (row._sheet_tab || "Active Leads");
      await api.deleteLead(rowNum, targetTabRange);
      toast.success("Lead deleted successfully");
      await loadData(false, true);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete lead");
    } finally {
      setRefreshing(false);
    }
  };

  const handleSaveLead = async (leadDataInput: Record<string, any>) => {
    try {
      setRefreshing(true);
      const targetRowNum =
        leadDataInput._row_num ||
        (selectedActionLead && selectedActionLead._row_num) ||
        (selectedLead && selectedLead._row_num);

      const targetTabRange = tab === "internal_leads" 
        ? "Internal Leads" 
        : tab === "pr_leads"
        ? "PR Leads"
        : ((leadDataInput._sheet_tab || (selectedActionLead && selectedActionLead._sheet_tab) || (selectedLead && selectedLead._sheet_tab)) || "Active Leads");

      if (targetRowNum) {
        const baseLead =
          (selectedActionLead && selectedActionLead._row_num === targetRowNum)
            ? selectedActionLead
            : selectedLead;
        const mergedData = baseLead ? { ...baseLead, ...leadDataInput } : leadDataInput;
        await api.updateLead(targetRowNum, mergedData, targetTabRange);
        toast.success("Lead updated successfully");
        if (selectedActionLead && selectedActionLead._row_num === targetRowNum) {
          setSelectedActionLead(mergedData);
        }
      } else {
        await api.addLead(leadDataInput, targetTabRange);
        toast.success("Lead added successfully");
        // Reset filters so the newly added lead is immediately visible
        setDateFilter({ preset: "all", startDate: "", endDate: "" });
        setSelectedKpiTab("Total Leads");
        setSearchTerm("");
      }
      await loadData(false, true);
    } catch (err: any) {
      toast.error(err.message || "Failed to save lead");
      throw err;
    } finally {
      setRefreshing(false);
    }
  };

  const handleQuickUpdateStage = async (row: Record<string, any>, newStage: string) => {
    try {
      setRefreshing(true);
      const rowNum = row._row_num;
      if (!rowNum) {
        toast.error("Invalid lead row index");
        return;
      }
      const targetTabRange = tab === "internal_leads" 
        ? "Internal Leads" 
        : tab === "pr_leads" 
        ? "PR Leads" 
        : (row._sheet_tab || "Active Leads");
      const updatedRow = { ...row, Stage: newStage, "Lead Status": newStage };

      // Optimistic update in local state for instantaneous feedback
      setSheetData((prev) => {
        if (!prev) return prev;
        const newRows = prev.rows.map((r) =>
          r._row_num === rowNum ? { ...r, Stage: newStage, "Lead Status": newStage } : r
        );
        return { ...prev, rows: newRows };
      });

      await api.updateLead(rowNum, updatedRow, targetTabRange);
      toast.success(`Proposal stage moved to "${newStage}"`);
      await loadData(false, true);
    } catch (err: any) {
      toast.error(err.message || "Failed to update proposal stage");
      await loadData(false, true);
    } finally {
      setRefreshing(false);
    }
  };

  const handleQuickUpdateField = async (row: Record<string, any>, col: string, newValue: string) => {
    try {
      const rowNum = row._row_num;
      if (!rowNum) {
        toast.error("Invalid lead row index");
        return;
      }
      const updatedRow: Record<string, any> = { ...row, [col]: newValue };
      if (col === "Stage") {
        updatedRow["Lead Status"] = newValue;
      } else if (col === "Lead Status") {
        updatedRow["Stage"] = newValue;
      } else if (col === "Status") {
        updatedRow["Lead"] = newValue;
      } else if (col === "Lead") {
        updatedRow["Status"] = newValue;
      }
      const targetTabRange = tab === "internal_leads" 
        ? "Internal Leads" 
        : tab === "pr_leads" 
        ? "PR Leads" 
        : (row._sheet_tab || "Active Leads");

      // Optimistic update in local state
      setSheetData((prev) => {
        if (!prev) return prev;
        const newRows = prev.rows.map((r) =>
          r._row_num === rowNum ? { ...r, ...updatedRow } : r
        );
        return { ...prev, rows: newRows };
      });

      await api.updateLead(rowNum, updatedRow, targetTabRange);
      toast.success(`${col} updated to "${newValue || "None"}"`);
      await loadData(false, true);
    } catch (err: any) {
      toast.error(err.message || `Failed to update ${col}`);
      await loadData(false, true);
      throw err;
    }
  };

  const isConfigured = summary?.configured || sheetData?.configured || (sheetData && sheetData.rows.length > 0);

  // Dynamic default graph configuration based on sheet headers
  const dateCol = sheetData?.headers.find(h => h.toLowerCase().includes("date")) || sheetData?.headers[5] || "";
  const valCol = sheetData?.headers.find(h => {
    const hl = h.toLowerCase();
    return hl.includes("value") || hl.includes("amount") || hl.includes("revenue") || hl.includes("deal size");
  }) || sheetData?.headers[3] || "";
  const stageCol = sheetData?.headers.find(h => h.toLowerCase().includes("stage") || h.toLowerCase().includes("status")) || sheetData?.headers[2] || "";

  // Resolved date range from the active preset/custom date filter
  const activeDateRange = React.useMemo(() => getPresetRange(dateFilter), [dateFilter]);

  const isTendersTab = tab === "tenders";
  const isInternalLeadsTab = tab === "internal_leads";
  const isPrLeadsTab = tab === "pr_leads";

  // Filter rows by tab (lead type) and selected month
  const filteredRows = React.useMemo(() => {
    if (!sheetData || !sheetData.rows) return [];
    
    const sourceColName = sheetData.headers.find(h => {
      const hl = h.toLowerCase().trim();
      return hl === "source" || hl === "sources" || hl.includes("source") || hl.includes("lead source");
    }) || "Source";

    const isRowTender = (row: Record<string, any>) => {
      const val = String(row[sourceColName] || "").trim().toLowerCase();
      if (val === "tender") return true;
      for (const [k, v] of Object.entries(row)) {
        const kl = k.toLowerCase().trim();
        if ((kl === "source" || kl === "sources" || kl.includes("source") || kl.includes("lead source")) && String(v || "").trim().toLowerCase() === "tender") {
          return true;
        }
      }
      return false;
    };

    let rows = sheetData.rows;

    // By default, strictly filter out hidden / collapsed rows from Google Sheets (archive)
    if (!includeArchived) {
      rows = rows.filter(row => !row._is_hidden);
    }

    if (isTendersTab) {
      // Tender Section: strictly rows where Source is 'Tender'
      rows = rows.filter(row => isRowTender(row));
    } else if (isInternalLeadsTab || isPrLeadsTab) {
      // Internal Leads / PR Leads Section: fetched directly from primary sheet tab
      rows = rows;
    } else {
      // Active Leads Section: strictly exclude any row where Source is 'Tender' so they appear in Tender ONLY
      rows = rows.filter(row => !isRowTender(row));
    }

    let finalRows = rows;
    if (activeDateRange && dateCol) {
      finalRows = rows.filter(row => {
        const d = parseDate(row[dateCol]);
        if (!d) return false;
        return d >= activeDateRange.start && d <= activeDateRange.end;
      });
    }

    // Default sort by Date descending (latest leads first, then older ones)
    if (dateCol) {
      return [...finalRows].sort((a, b) => {
        const dateA = parseDate(a[dateCol]);
        const dateB = parseDate(b[dateCol]);
        if (dateA && dateB) return dateB.getTime() - dateA.getTime();
        if (dateA && !dateB) return -1;
        if (!dateA && dateB) return 1;
        return 0;
      });
    }

    return finalRows;
  }, [sheetData, activeDateRange, dateCol, isTendersTab, isInternalLeadsTab, includeArchived]);

  const filteredSheetData = React.useMemo<SheetData | null>(() => {
    if (!sheetData) return null;
    return {
      ...sheetData,
      rows: filteredRows
    };
  }, [sheetData, filteredRows]);

  // Active Leads non-tender sheet data slice (used by Proposal Tracker & Follow-Ups to exclude Tenders)
  const activeLeadsSheetData = React.useMemo<SheetData | null>(() => {
    if (!sheetData || !sheetData.rows) return null;
    const sourceColName = sheetData.headers.find(h => {
      const hl = h.toLowerCase().trim();
      return hl === "source" || hl === "sources" || hl.includes("source") || hl.includes("lead source");
    }) || "Source";

    const nonTenders = sheetData.rows.filter(row => {
      if (!includeArchived && row._is_hidden) return false;
      const val = String(row[sourceColName] || "").trim().toLowerCase();
      if (val === "tender") return false;
      for (const [k, v] of Object.entries(row)) {
        const kl = k.toLowerCase().trim();
        if ((kl === "source" || kl === "sources" || kl.includes("source") || kl.includes("lead source")) && String(v || "").trim().toLowerCase() === "tender") {
          return false;
        }
      }
      return true;
    });

    return {
      ...sheetData,
      rows: nonTenders,
      total: nonTenders.length
    };
  }, [sheetData, includeArchived]);

  // Source breakdown for the Dashboard cards: Inbound (Internal Leads), Outbound (Active Leads),
  // PR (PR Leads), Govt (Tenders within Active Leads)
  const sourceBreakdown = React.useMemo(() => {
    const outboundDateCol = sheetData?.headers.find(h => h.toLowerCase().includes("date")) || "";
    const inboundDateCol = internalLeadsData?.headers.find(h => h.toLowerCase().includes("date")) || "";
    const prDateCol = prLeadsData?.headers.find(h => h.toLowerCase().includes("date")) || "";

    const inRange = (row: Record<string, any>, col: string) => {
      if (!activeDateRange || !col) return true;
      const d = parseDate(row[col]);
      return !!d && d >= activeDateRange.start && d <= activeDateRange.end;
    };

    const countVisible = (data: SheetData | null, dateColForData: string) => {
      if (!data || !data.rows) return 0;
      return data.rows.filter(row => (includeArchived || !row._is_hidden) && inRange(row, dateColForData)).length;
    };

    const sourceColName = sheetData?.headers.find(h => {
      const hl = h.toLowerCase().trim();
      return hl === "source" || hl === "sources" || hl.includes("source") || hl.includes("lead source");
    }) || "Source";

    const tenderCount = sheetData?.rows
      ? sheetData.rows.filter(row => {
          if (!includeArchived && row._is_hidden) return false;
          if (!inRange(row, outboundDateCol)) return false;
          return String(row[sourceColName] || "").trim().toLowerCase() === "tender";
        }).length
      : 0;

    const outboundCount = (activeLeadsSheetData?.rows || []).filter(row => inRange(row, outboundDateCol)).length;

    return {
      outbound: outboundCount,
      inbound: countVisible(internalLeadsData, inboundDateCol),
      pr: countVisible(prLeadsData, prDateCol),
      govt: tenderCount,
    };
  }, [sheetData, activeLeadsSheetData, internalLeadsData, prLeadsData, includeArchived, activeDateRange]);

  // Combined revenue data for the Dashboard tab's Revenue Analysis widget:
  // Active Leads (Outbound + Govt/Tender) + Internal Leads (Inbound) + PR Leads (PR), all summed together
  const dashboardRevenueSheetData = React.useMemo<SheetData | null>(() => {
    if (!sheetData) return null;

    const byMonth = (rows: Record<string, any>[]) => {
      if (!activeDateRange || !dateCol) return rows;
      return rows.filter(row => {
        const d = parseDate(row[dateCol]);
        if (!d) return false;
        return d >= activeDateRange.start && d <= activeDateRange.end;
      });
    };

    const visible = (rows: Record<string, any>[]) => rows.filter(row => includeArchived || !row._is_hidden);

    const combinedRows = [
      ...byMonth(visible(sheetData.rows || [])),
      ...byMonth(visible(internalLeadsData?.rows || [])),
      ...byMonth(visible(prLeadsData?.rows || [])),
    ];

    const headerSet = new Set<string>([
      ...sheetData.headers,
      ...(internalLeadsData?.headers || []),
      ...(prLeadsData?.headers || []),
    ]);

    return {
      ...sheetData,
      headers: Array.from(headerSet),
      rows: combinedRows,
      total: combinedRows.length,
    };
  }, [sheetData, internalLeadsData, prLeadsData, includeArchived, activeDateRange, dateCol]);

  // Helper to categorize lead rows
  const getLeadCategory = (row: Record<string, any>): "won" | "lost" | "active" => {
    const stgVals: string[] = [];
    for (const [k, v] of Object.entries(row)) {
      const kl = k.toLowerCase().trim();
      if (kl === "stage" || kl.includes("stage") || kl === "status" || kl.includes("status")) {
        const val = String(v || "").toLowerCase().trim();
        if (val) stgVals.push(val);
      }
    }

    let isWon = false;
    let isLost = false;
    let isActive = false;

    stgVals.forEach(stg => {
      if (["won", "closed won", "converted", "completed", "hired", "success"].some(x => stg.includes(x))) {
        isWon = true;
      }
      if (["lost", "closed lost", "dead", "cold", "dropped", "not qualified", "spam"].some(x => stg.includes(x))) {
        isLost = true;
      }
      if (["proposal", "negotiation", "active", "discovery", "follow-up", "warm", "hot", "contacted", "lead", "meeting", "portfolio"].some(x => stg.includes(x))) {
        isActive = true;
      }
    });

    if (isWon) return "won";
    if (isLost) return "lost";
    if (isActive) return "active";
    return "active";
  };

  // Dashboard "Leads" trend: Inbound / Outbound / PR / Government estimated revenue for the selected duration
  const leadsTrendData = React.useMemo(() => {
    const months = getRangeMonths(leadsTrendMonths);

    const outboundRows = (activeLeadsSheetData?.rows || []).filter(r => includeArchived || !r._is_hidden);
    const inboundRows = (internalLeadsData?.rows || []).filter(r => includeArchived || !r._is_hidden);
    const prRows = (prLeadsData?.rows || []).filter(r => includeArchived || !r._is_hidden);

    const sourceColName = sheetData?.headers.find(h => {
      const hl = h.toLowerCase().trim();
      return hl === "source" || hl === "sources" || hl.includes("source") || hl.includes("lead source");
    }) || "Source";
    const govtRows = (sheetData?.rows || []).filter(row => {
      if (!includeArchived && row._is_hidden) return false;
      return String(row[sourceColName] || "").trim().toLowerCase() === "tender";
    });

    const outboundDateCol = sheetData?.headers.find(h => h.toLowerCase().includes("date")) || "";
    const inboundDateCol = internalLeadsData?.headers.find(h => h.toLowerCase().includes("date")) || "";
    const prDateCol = prLeadsData?.headers.find(h => h.toLowerCase().includes("date")) || "";

    const outboundRevenueCol = findRevenueHeader(sheetData?.headers);
    const inboundRevenueCol = findRevenueHeader(internalLeadsData?.headers);
    const prRevenueCol = findRevenueHeader(prLeadsData?.headers);

    const sumRevenueForMonth = (rows: Record<string, any>[], dateCol: string, revenueCol: string, m: { year: number; month: number }) => {
      if (!dateCol || !revenueCol) return 0;
      return rows.reduce((sum, row) => {
        const d = parseDate(row[dateCol]);
        if (!d || d.getFullYear() !== m.year || d.getMonth() !== m.month) return sum;
        return sum + parseRevenueValue(row[revenueCol]);
      }, 0);
    };

    return months.map(m => ({
      name: m.label,
      Inbound: sumRevenueForMonth(inboundRows, inboundDateCol, inboundRevenueCol, m),
      Outbound: sumRevenueForMonth(outboundRows, outboundDateCol, outboundRevenueCol, m),
      PR: sumRevenueForMonth(prRows, prDateCol, prRevenueCol, m),
      Government: sumRevenueForMonth(govtRows, outboundDateCol, outboundRevenueCol, m),
    }));
  }, [activeLeadsSheetData, internalLeadsData, prLeadsData, sheetData, includeArchived, leadsTrendMonths]);

  // Dashboard "Lead by Channel": month-wise lead counts for Inbound / Outbound / PR / Government
  const leadsByChannelData = React.useMemo(() => {
    const months = getRangeMonths(leadsByChannelMonths);

    const outboundRows = (activeLeadsSheetData?.rows || []).filter(r => includeArchived || !r._is_hidden);
    const inboundRows = (internalLeadsData?.rows || []).filter(r => includeArchived || !r._is_hidden);
    const prRows = (prLeadsData?.rows || []).filter(r => includeArchived || !r._is_hidden);

    const sourceColName = sheetData?.headers.find(h => {
      const hl = h.toLowerCase().trim();
      return hl === "source" || hl === "sources" || hl.includes("source") || hl.includes("lead source");
    }) || "Source";
    const govtRows = (sheetData?.rows || []).filter(row => {
      if (!includeArchived && row._is_hidden) return false;
      return String(row[sourceColName] || "").trim().toLowerCase() === "tender";
    });

    const outboundDateCol = sheetData?.headers.find(h => h.toLowerCase().includes("date")) || "";
    const inboundDateCol = internalLeadsData?.headers.find(h => h.toLowerCase().includes("date")) || "";
    const prDateCol = prLeadsData?.headers.find(h => h.toLowerCase().includes("date")) || "";

    const countForMonth = (rows: Record<string, any>[], col: string, m: { year: number; month: number }) => {
      if (!col) return 0;
      return rows.filter(row => {
        const d = parseDate(row[col]);
        return !!d && d.getFullYear() === m.year && d.getMonth() === m.month;
      }).length;
    };

    return months.map(m => ({
      name: m.label,
      Inbound: countForMonth(inboundRows, inboundDateCol, m),
      Outbound: countForMonth(outboundRows, outboundDateCol, m),
      PR: countForMonth(prRows, prDateCol, m),
      Government: countForMonth(govtRows, outboundDateCol, m),
    }));
  }, [activeLeadsSheetData, internalLeadsData, prLeadsData, sheetData, includeArchived, leadsByChannelMonths]);

  // Calculate display KPIs dynamically based on filtered rows (strictly 4 tabs: Total Leads, Active Leads, Closed Won, Closed Lost)
  const displayKpis = React.useMemo(() => {
    if (!sheetData) return [];
    const rows = filteredRows;
    const totalRows = rows.length;

    let activeCount = 0;
    let closedWonCount = 0;
    let closedLostCount = 0;

    rows.forEach(row => {
      const cat = getLeadCategory(row);
      if (cat === "won") closedWonCount++;
      else if (cat === "lost") closedLostCount++;
      else activeCount++;
    });

    return [
      { label: "Total Leads", value: totalRows.toLocaleString("en-IN")},
      { label: "Active Leads", value: activeCount.toLocaleString("en-IN")},
      { label: "Won", value: closedWonCount.toLocaleString("en-IN")},
      { label: "Lost", value: closedLostCount.toLocaleString("en-IN") }
    ];
  }, [filteredRows, sheetData]);

  // Dashboard "Lead Overview" KPIs: Total/Active/Won/Lost combined across all 4 channels
  // (Inbound + Outbound + PR + Government), reusing the same combined dataset as the Revenue chart
  const dashboardOverviewKpis = React.useMemo(() => {
    if (!dashboardRevenueSheetData) return [];
    const rows = dashboardRevenueSheetData.rows;
    const totalRows = rows.length;

    let activeCount = 0;
    let closedWonCount = 0;
    let closedLostCount = 0;

    rows.forEach(row => {
      const cat = getLeadCategory(row);
      if (cat === "won") closedWonCount++;
      else if (cat === "lost") closedLostCount++;
      else activeCount++;
    });

    return [
      { label: "Total Leads", value: totalRows.toLocaleString("en-IN") },
      { label: "Active Leads", value: activeCount.toLocaleString("en-IN") },
      { label: "Won", value: closedWonCount.toLocaleString("en-IN") },
      { label: "Lost", value: closedLostCount.toLocaleString("en-IN") },
    ];
  }, [dashboardRevenueSheetData]);

  // Table rows filtered by the selected KPI tab
  const tableRows = React.useMemo(() => {
    if (selectedKpiTab === "Active Leads") {
      return filteredRows.filter(r => getLeadCategory(r) === "active");
    }
    if (selectedKpiTab === "Closed Won") {
      return filteredRows.filter(r => getLeadCategory(r) === "won");
    }
    if (selectedKpiTab === "Closed Lost") {
      return filteredRows.filter(r => getLeadCategory(r) === "lost");
    }
    return filteredRows;
  }, [filteredRows, selectedKpiTab]);

  const defaultLineGraph: GraphConfig = {
    id: "default-line",
    type: "line",
    title: "Deals & Revenue History",
    x_col: dateCol,
    y_col: valCol
  };

  const defaultPieGraph: GraphConfig = {
    id: "default-pie",
    type: "pie",
    title: "Lead Status Breakdown",
    x_col: "Status",
    y_col: ""
  };

  const userGraphs = summary?.graphs || [];
  const lineGraphs = userGraphs.filter(g => g.type !== "pie");
  const pieGraphs = userGraphs.filter(g => g.type === "pie");

  const primaryLineGraph = lineGraphs[0] || defaultLineGraph;
  const primaryPieGraph = pieGraphs[0] || defaultPieGraph;

  const extraGraphs = [
    ...lineGraphs.slice(1),
    ...pieGraphs.slice(1)
  ];

  const deadlineHeader = sheetData?.headers.find(h => {
    const hl = h.toLowerCase();
    return hl.includes("deadline") || hl.includes("due");
  }) || "";

  const dueTodayLeads = deadlineHeader
    ? filteredRows.filter(row => isToday(row[deadlineHeader]))
    : [];

  if (loading) {
    return (
      <DashboardShell>
        <div className="space-y-8 animate-pulse">
          <div className="h-10 w-48 bg-white/5 rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="h-24 bg-white/5 rounded-lg" />
            <div className="h-24 bg-white/5 rounded-lg" />
            <div className="h-24 bg-white/5 rounded-lg" />
            <div className="h-24 bg-white/5 rounded-lg" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-96 bg-white/5 rounded-lg" />
            <div className="lg:col-span-1 h-96 bg-white/5 rounded-lg" />
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      {!isConfigured ? (
        <EmptyState onLoadMock={handleLoadMock} />
      ) : tab === "data" && sheetData ? (
        <DataPlatformView sheetData={sheetData} onRefresh={() => loadData(false, true)} />
      ) : tab === "followups" && sheetData ? (
        <>
          <FollowUpDashboardView
            sheetData={activeLeadsSheetData || sheetData}
            onEditLead={handleEditLead}
            onAddLead={() => {
              setSelectedLead({});
              setModalTitle("Schedule New Follow-Up");
              setIsLeadModalOpen(true);
            }}
            onSaveLead={handleSaveLead}
            onDeleteLead={handleDeleteLead}
            onRefresh={handleRefresh}
            refreshing={refreshing}
          />
          {/* Lead CRUD Modal for Follow-Ups */}
          <LeadFormModal
            isOpen={isLeadModalOpen}
            onClose={() => setIsLeadModalOpen(false)}
            headers={sheetData.headers}
            initialData={selectedLead}
            onSave={handleSaveLead}
            title={modalTitle}
            mandatoryColumns={summary?.mandatory_columns || []}
            defaultCogPoc={currentUser?.name}
          />
        </>
      ) : tab === "proposals" && sheetData ? (
        <>
          <ProposalTrackerView
            sheetData={activeLeadsSheetData || sheetData}
            onEditLead={handleEditLead}
            onAddLead={() => {
              setSelectedLead({ Stage: "Proposal sent" });
              setModalTitle("Track New Proposal");
              setIsLeadModalOpen(true);
            }}
            onUpdateStage={handleQuickUpdateStage}
            onDeleteLead={handleDeleteLead}
            onRefresh={handleRefresh}
            refreshing={refreshing}
          />
          {/* Lead CRUD Modal for Proposals */}
          <LeadFormModal
            isOpen={isLeadModalOpen}
            onClose={() => setIsLeadModalOpen(false)}
            headers={sheetData.headers}
            initialData={selectedLead}
            onSave={handleSaveLead}
            title={modalTitle}
            mandatoryColumns={summary?.mandatory_columns || []}
            defaultCogPoc={currentUser?.name}
          />
        </>
      ) : tab === "tenders" && sheetData ? (
        <TenderDashboardView
          sheetData={sheetData}
          onRefresh={handleRefresh}
          onSaveLead={handleSaveLead}
          onDeleteLead={handleDeleteLead}
          refreshing={refreshing}
        />
      ) : tab === "help" ? (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-sans text-2xl text-gray-900 dark:text-white font-bold tracking-tight">Help & Documentation</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Learn how to manage your workspace, sync Google Sheets, and configure CRM metrics.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 bg-white dark:bg-[#111118] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] rounded-2xl shadow-sm space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Connecting Google Sheets</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                To sync live lead data, navigate to <strong className="text-emerald-500">Settings</strong> and paste your Google Sheet URL. Ensure your sheet is shared with View permissions.
              </p>
            </div>
            <div className="p-5 bg-white dark:bg-[#111118] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] rounded-2xl shadow-sm space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Managing Sidebar Categories</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                The sidebar categorizes your leads into <strong>Active Leads</strong>, <strong>Internal Leads</strong>, <strong>Tender</strong>, and <strong>Data Platform</strong>.
              </p>
            </div>
            <div className="p-5 bg-white dark:bg-[#111118] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] rounded-2xl shadow-sm space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Adding & Updating Leads</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Click <strong className="text-emerald-500">+ Add Lead</strong> on the dashboard to push new rows directly into your connected Google Sheet in real-time.
              </p>
            </div>
            <div className="p-5 bg-white dark:bg-[#111118] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] rounded-2xl shadow-sm space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Custom Charts & Widgets</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                Click <strong className="text-emerald-500">+ Add Widget</strong> to build interactive line charts and pie breakdowns based on any column in your spreadsheet.
              </p>
            </div>
          </div>
        </div>
      ) : tab === "dashboard" && sheetData ? (
        <div className="space-y-6 relative">
          {/* Due Today Alert Box floating in the top right */}
          {dueTodayLeads.length > 0 && showAlertPanel && (
            <div className="fixed top-6 right-6 z-50 w-80 bg-red-50/95 dark:bg-[#1E0D10]/95 border border-red-200 dark:border-red-900/50 rounded-2xl border-l-4 border-l-red-500 p-4 shadow-2xl animate-fade-in transition-all flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </div>
                  <span className="text-xs font-semibold text-gray-900 dark:text-white flex items-center gap-1.5 font-sans">
                    <Bell className="w-3.5 h-3.5 text-red-500" />
                    Leads Due Today ({dueTodayLeads.length})
                  </span>
                </div>
                <button
                  onClick={() => setShowAlertPanel(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-white/5 rounded text-gray-400 dark:text-[#555566] hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {dueTodayLeads.map((lead, idx) => (
                  <div
                    key={idx}
                    className="p-2 bg-gray-50/50 dark:bg-[#161622] rounded-xl border border-black dark:border-black flex items-center justify-between text-[11px] font-sans"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">
                        {lead["Company"] || lead["Campaign"] || "Unnamed Lead"}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-[#888899] truncate">
                        {lead["Name"] ? `Contact: ${lead["Name"]}` : (lead["Stage"] ? `Stage: ${lead["Stage"]}` : "No contact details")}
                      </p>
                    </div>
                    {lead["Value"] && (
                      <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 ml-2 shrink-0 font-mono">
                        {lead["Value"]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dashboard Title & Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="font-sans text-2xl text-gray-900 dark:text-white font-bold tracking-tight">
                Dashboard
              </h1>

              {sheetData && <DateRangeFilter value={dateFilter} onChange={setDateFilter} />}
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {!sheetData?.is_mock && (
                <>
                  {/* Unhidden vs All Leads Toggle */}
                  {sheetData && (sheetData.hidden_count || 0) > 0 && (
                    <button
                      onClick={() => setIncludeArchived(!includeArchived)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-sans font-semibold transition-all cursor-pointer border ${
                        includeArchived
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 shadow-xs"
                          : "bg-white dark:bg-[#111118] hover:bg-gray-50 dark:hover:bg-[#1C1C2D] border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300"
                      }`}
                      title={includeArchived ? "Switch back to viewing only unhidden active leads" : `Include ${sheetData.hidden_count} hidden/archived rows from Google Sheets`}
                    >
                      {includeArchived ? (
                        <>
                          <Eye className="w-3.5 h-3.5 text-amber-500" />
                          <span>All Leads ({filteredRows.length})</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Active Leads Only ({filteredRows.length})</span>
                          <span className="text-[10px] text-gray-400 font-normal">
                            ({sheetData.hidden_count} hidden)
                          </span>
                        </>
                      )}
                    </button>
                  )}

                  {/* <button
                    onClick={handleAddLead}
                    className="px-3 py-1.5 bg-white dark:bg-[#111118] hover:bg-gray-55 dark:hover:bg-[#1C1C2D] text-gray-700 dark:text-white border border-gray-200 dark:border-[rgba(255,255,255,0.06)] rounded-lg text-xs font-sans font-semibold transition-all cursor-pointer"
                  >
                    + Add Lead
                  </button> */}

                  {/* <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="p-1.5 bg-white dark:bg-[rgba(255,255,255,0.03)] hover:bg-gray-55 dark:hover:bg-[rgba(255,255,255,0.08)] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] text-gray-700 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 text-xs font-sans"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-emerald-500 dark:text-emerald-400" : ""}`} />
                    Sync Now
                  </button> */}

                  <button
                    onClick={() => setShowAlertPanel(prev => !prev)}
                    className={`relative p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                      showAlertPanel
                        ? "bg-red-50 border-red-200 text-red-600 dark:bg-red-950/30 dark:border-red-900/40 dark:text-red-400"
                        : "bg-white dark:bg-[rgba(255,255,255,0.03)] hover:bg-gray-50 dark:hover:bg-[rgba(255,255,255,0.08)] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] text-gray-700 dark:text-white"
                    }`}
                    title="Toggle Due Today Alerts"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    {dueTodayLeads.length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white shadow-sm">
                        {dueTodayLeads.length}
                      </span>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Lead Overview: combined across Inbound + Outbound + PR + Government */}
          <DashboardSection title="Lead Overview">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {dashboardOverviewKpis.map((kpi, index) => (
                <MetricCard
                  key={kpi.label}
                  label={kpi.label}
                  value={String(kpi.value)}
                  index={index}
                />
              ))}
            </div>
          </DashboardSection>

          {/* Estimated Revenue: combined across Inbound + Outbound + PR + Government */}
          {dashboardRevenueSheetData && (
            <DashboardSection title="Estimated Revenue">
              <RevenueAnalysisWidget sheetData={dashboardRevenueSheetData} />
            </DashboardSection>
          )}

          {/* Lead Source Breakdown: Inbound (Internal Leads) / Outbound (Active Leads) / PR (PR Leads) / Govt (Tenders) */}
          <DashboardSection title="Lead Source Breakdown">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: "Outbound", tab: "active_leads", count: sourceBreakdown.outbound, dot: "#3B82F6", bar: "#3B82F6", border: "border-blue-200/70 dark:border-blue-900/30", bg: "bg-[#EFF6FF] dark:bg-blue-950/20" },
                { label: "Inbound", tab: "internal_leads", count: sourceBreakdown.inbound, dot: "#10B981", bar: "#10B981", border: "border-emerald-200/70 dark:border-emerald-900/30", bg: "bg-[#F0FDF4] dark:bg-emerald-950/20" },
                { label: "PR", tab: "pr_leads", count: sourceBreakdown.pr, dot: "#D946EF", bar: "#D946EF", border: "border-fuchsia-200/70 dark:border-fuchsia-900/30", bg: "bg-[#FDF4FF] dark:bg-fuchsia-950/20" },
                { label: "Government", tab: "tenders", count: sourceBreakdown.govt, dot: "#F97316", bar: "#F97316", border: "border-orange-200/70 dark:border-orange-900/30", bg: "bg-[#FFF7ED] dark:bg-orange-950/20" },
              ].map((card) => {
                const sourceTotal = sourceBreakdown.inbound + sourceBreakdown.outbound + sourceBreakdown.pr + sourceBreakdown.govt;
                const pct = sourceTotal > 0 ? (card.count / sourceTotal) * 100 : 0;
                return (
                  <Link
                    key={card.label}
                    href={`/dashboard?tab=${card.tab}`}
                    className={`py-2.5 px-3.5 rounded-2xl border ${card.border} ${card.bg} flex flex-col justify-between shadow-xs transition-all min-h-[68px] cursor-pointer hover:shadow-md hover:-translate-y-0.5`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: card.dot }} />
                        <span className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">{card.label}</span>
                      </div>
                      {/* <span className="text-xs font-mono text-gray-400 dark:text-[#777788] shrink-0">({card.count.toLocaleString("en-IN")})</span> */}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-3">
                      <span className="text-sm sm:text-base font-bold text-gray-900 dark:text-white font-sans tracking-tight truncate shrink-0">
                        {card.count.toLocaleString("en-IN")} Leads
                      </span>
                      <div className="flex items-center gap-2 flex-1 max-w-[130px]">
                        <div className="w-full bg-gray-200/80 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ width: `${pct}%`, backgroundColor: card.bar }}
                          />
                        </div>
                        <span className="text-[10px] text-gray-400 dark:text-[#888899] font-mono shrink-0">
                          {pct.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </DashboardSection>

          {/* Trends: Revenue & Lead by Channel over time */}
          <DashboardSection title="Trends">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <LeadsTrendWidget data={leadsTrendData} rangeMonths={leadsTrendMonths} onRangeMonthsChange={setLeadsTrendMonths} />
              <LeadsByChannelWidget data={leadsByChannelData} rangeMonths={leadsByChannelMonths} onRangeMonthsChange={setLeadsByChannelMonths} />
            </div>
          </DashboardSection>

          {/* Lead CRUD Modal */}
          <LeadFormModal
            isOpen={isLeadModalOpen}
            onClose={() => setIsLeadModalOpen(false)}
            headers={sheetData.headers}
            initialData={selectedLead}
            onSave={handleSaveLead}
            title={modalTitle}
            currentTab={tab}
            mandatoryColumns={summary?.mandatory_columns || []}
            defaultCogPoc={currentUser?.name}
          />

          {/* Action Conversation Modal */}
          <ActionConversationModal
            isOpen={isActionModalOpen}
            onClose={() => setIsActionModalOpen(false)}
            lead={selectedActionLead}
            onSaveLead={handleSaveLead}
            currentUser={currentUser}
          />
        </div>
      ) : (
        <div className="space-y-6 relative">
          {/* Due Today Alert Box floating in the top right */}
          {dueTodayLeads.length > 0 && showAlertPanel && (
            <div className="fixed top-6 right-6 z-50 w-80 bg-red-50/95 dark:bg-[#1E0D10]/95 border border-red-200 dark:border-red-900/50 rounded-2xl border-l-4 border-l-red-500 p-4 shadow-2xl animate-fade-in transition-all flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                  </div>
                  <span className="text-xs font-semibold text-gray-900 dark:text-white flex items-center gap-1.5 font-sans">
                    <Bell className="w-3.5 h-3.5 text-red-500" />
                    Leads Due Today ({dueTodayLeads.length})
                  </span>
                </div>
                <button
                  onClick={() => setShowAlertPanel(false)}
                  className="p-1 hover:bg-gray-100 dark:hover:bg-white/5 rounded text-gray-400 dark:text-[#555566] hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              
              <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
                {dueTodayLeads.map((lead, idx) => (
                  <div 
                    key={idx} 
                    className="p-2 bg-gray-50/50 dark:bg-[#161622] rounded-xl border border-black dark:border-black flex items-center justify-between text-[11px] font-sans"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">
                        {lead["Company"] || lead["Campaign"] || "Unnamed Lead"}
                      </p>
                      <p className="text-[10px] text-gray-400 dark:text-[#888899] truncate">
                        {lead["Name"] ? `Contact: ${lead["Name"]}` : (lead["Stage"] ? `Stage: ${lead["Stage"]}` : "No contact details")}
                      </p>
                    </div>
                    {lead["Value"] && (
                      <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 ml-2 shrink-0 font-mono">
                        {lead["Value"]}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Dashboard Title & Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h1 className="font-sans text-2xl text-gray-900 dark:text-white font-bold tracking-tight">
                {tab === "tenders" 
                  ? "Tender" 
                  : tab === "internal_leads" 
                  ? "Internal Leads" 
                  : tab === "pr_leads"
                  ? "PR Leads"
                  : tab === "data" 
                  ? "Data Platform" 
                  : tab === "help"
                  ? "Help"
                  : "Active Leads"}
              </h1>

              {sheetData && <DateRangeFilter value={dateFilter} onChange={setDateFilter} />}
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              {!sheetData?.is_mock && (
                <>
                  {/* Unhidden vs All Leads Toggle */}
                  {sheetData && (sheetData.hidden_count || 0) > 0 && (
                    <button
                      onClick={() => setIncludeArchived(!includeArchived)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-sans font-semibold transition-all cursor-pointer border ${
                        includeArchived
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 shadow-xs"
                          : "bg-white dark:bg-[#111118] hover:bg-gray-50 dark:hover:bg-[#1C1C2D] border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300"
                      }`}
                      title={includeArchived ? "Switch back to viewing only unhidden active leads" : `Include ${sheetData.hidden_count} hidden/archived rows from Google Sheets`}
                    >
                      {includeArchived ? (
                        <>
                          <Eye className="w-3.5 h-3.5 text-amber-500" />
                          <span>All Leads ({filteredRows.length})</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-emerald-500" />
                          <span>Active Leads Only ({filteredRows.length})</span>
                          <span className="text-[10px] text-gray-400 font-normal">
                            ({sheetData.hidden_count} hidden)
                          </span>
                        </>
                      )}
                    </button>
                  )}

                  <button
                    onClick={handleAddLead}
                    className="px-3 py-1.5 bg-white dark:bg-[#111118] hover:bg-gray-55 dark:hover:bg-[#1C1C2D] text-gray-700 dark:text-white border border-gray-200 dark:border-[rgba(255,255,255,0.06)] rounded-lg text-xs font-sans font-semibold transition-all cursor-pointer"
                  >
                    + Add Lead
                  </button>


                  <button
                    onClick={handleRefresh}
                    disabled={refreshing}
                    className="p-1.5 bg-white dark:bg-[rgba(255,255,255,0.03)] hover:bg-gray-55 dark:hover:bg-[rgba(255,255,255,0.08)] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] text-gray-700 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 text-xs font-sans"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin text-emerald-500 dark:text-emerald-400" : ""}`} />
                    Sync Now
                  </button>

                  <button
                    onClick={() => setShowAlertPanel(prev => !prev)}
                    className={`relative p-1.5 rounded-lg border transition-all cursor-pointer flex items-center justify-center ${
                      showAlertPanel
                        ? "bg-red-50 border-red-200 text-red-600 dark:bg-red-950/30 dark:border-red-900/40 dark:text-red-400"
                        : "bg-white dark:bg-[rgba(255,255,255,0.03)] hover:bg-gray-50 dark:hover:bg-[rgba(255,255,255,0.08)] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] text-gray-700 dark:text-white"
                    }`}
                    title="Toggle Due Today Alerts"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    {dueTodayLeads.length > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[9px] font-bold text-white shadow-sm">
                        {dueTodayLeads.length}
                      </span>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
          {/* Row 1: Top Metric KPI Cards (4 tabs: Total Leads, Active Leads, Closed Won, Closed Lost) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {displayKpis.map((kpi, index) => {
              const isSelected = selectedKpiTab === kpi.label;
              return (
                <MetricCard
                  key={kpi.label}
                  label={kpi.label}
                  value={String(kpi.value)}
                  // delta={kpi.delta}
                  index={index}
                  isSelected={isSelected}
                  onClick={() => {
                    setSelectedKpiTab(prev => prev === kpi.label ? "Total Leads" : kpi.label);
                  }}
                />
              );
            })}
          </div>

          {/* Row 2: Revenue Analysis & Pipeline Breakdown (One Straight Line) */}
          {filteredSheetData && (
            <div className="w-full">
              <RevenueAnalysisWidget sheetData={filteredSheetData} />
            </div>
          )}

          {/* Row 3: Campaign Performance Table (Full Width) */}
          <div className="w-full">
            {sheetData && (
              <CRMTable
                headers={sheetData.headers}
                rows={tableRows}
                visibleColumns={summary?.visible_columns || []}
                columnOrder={summary?.column_order || []}
                onSaveConfig={handleSaveTableConfig}
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                onEdit={!sheetData?.is_mock ? handleEditLead : undefined}
                onDelete={!sheetData?.is_mock ? handleDeleteLead : undefined}
                onQuickUpdate={!sheetData?.is_mock ? handleQuickUpdateField : undefined}
                isTenderDashboard={isTendersTab}
                currentTab={tab}
                activeKpiFilter={selectedKpiTab}
                onResetKpiFilter={() => setSelectedKpiTab("Total Leads")}
                onOpenAction={handleEditLead}
                currentUser={currentUser}
              />
            )}
          </div>

          {/* Row 3: Extra Graphs (If any) */}
          {extraGraphs.length > 0 && sheetData && (
            <div className="space-y-4 pt-6 border-t border-[rgba(255,255,255,0.06)]">
              <h3 className="text-xs font-semibold text-white tracking-wide uppercase font-mono text-[#888899]">More Visual Insights</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {extraGraphs.map((g) => (
                  <GraphWidget
                    key={g.id}
                    graph={g}
                    rows={filteredRows}
                    onDelete={handleDeleteGraph}
                    height={200}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Builder Modal */}
          {sheetData && (
            <GraphBuilder
              isOpen={isBuilderOpen}
              onClose={() => setIsBuilderOpen(false)}
              headers={sheetData.headers}
              rows={filteredRows}
              onSave={handleAddGraph}
            />
          )}

          {/* Lead CRUD Modal */}
          {sheetData && (
            <LeadFormModal
              isOpen={isLeadModalOpen}
              onClose={() => setIsLeadModalOpen(false)}
              headers={sheetData.headers}
              initialData={selectedLead}
              onSave={handleSaveLead}
              title={modalTitle}
              currentTab={tab}
              mandatoryColumns={summary?.mandatory_columns || []}
              defaultCogPoc={currentUser?.name}
            />
          )}

          {/* Action Conversation Modal (triggered by clicking edit on any lead row) */}
          <ActionConversationModal
            isOpen={isActionModalOpen}
            onClose={() => setIsActionModalOpen(false)}
            lead={selectedActionLead}
            onSaveLead={handleSaveLead}
            currentUser={currentUser}
          />
        </div>
      )}
    </DashboardShell>
  );
}


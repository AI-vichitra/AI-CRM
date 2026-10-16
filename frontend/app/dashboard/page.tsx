"use client";

import React, { useState, useEffect, Suspense } from "react";
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
  const [selectedMonth, setSelectedMonth] = useState("All");
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedKpiTab, setSelectedKpiTab] = useState<string>("Total Leads");

  // Lead modal states
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Record<string, any> | null>(null);
  const [modalTitle, setModalTitle] = useState("Add New Lead");

  // Action / Conversation modal states
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [selectedActionLead, setSelectedActionLead] = useState<Record<string, any> | null>(null);

  async function loadData(showToast = false, bypassCache = false) {
    try {
      // Target range based on tab: "Internal Leads" for internal leads, "Active Leads" for Active Leads & Tender
      const targetTabRange = tab === "internal_leads" ? "Internal Leads" : "Active Leads";

      const [sum, data] = await Promise.all([
        api.getDashboardSummary(bypassCache),
        api.getSheetData(bypassCache, targetTabRange),
      ]);
      setSummary(sum);
      setSheetData(data);
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
      await api.deleteLead(rowNum);
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
      const targetRowNum = leadDataInput._row_num || (selectedLead && selectedLead._row_num);
      if (targetRowNum) {
        const mergedData = selectedLead ? { ...selectedLead, ...leadDataInput } : leadDataInput;
        await api.updateLead(targetRowNum, mergedData);
        toast.success("Lead updated successfully");
      } else {
        await api.addLead(leadDataInput);
        toast.success("Lead added successfully");
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
      const updatedRow = { ...row, Stage: newStage };
      await api.updateLead(rowNum, updatedRow);
      toast.success(`Proposal stage moved to "${newStage}"`);
      await loadData(false, true);
    } catch (err: any) {
      toast.error(err.message || "Failed to update proposal stage");
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
      const updatedRow = { ...row, [col]: newValue };
      await api.updateLead(rowNum, updatedRow);
      toast.success(`${col} updated to "${newValue || "None"}"`);
      await loadData(false, true);
    } catch (err: any) {
      toast.error(err.message || `Failed to update ${col}`);
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

  const getMonthName = (m: number): string => {
    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    return months[m - 1] || "";
  };

  // Get unique months list for dropdown
  const uniqueMonths = React.useMemo(() => {
    if (!sheetData || !sheetData.rows || !dateCol) return [];
    const monthsMap: Record<string, string> = {};
    
    sheetData.rows.forEach(row => {
      const dateVal = row[dateCol];
      if (!dateVal) return;
      const parts = String(dateVal).trim().replace(/\s+/g, "").split(/[-/.]/);
      if (parts.length === 3) {
        const p0 = parseInt(parts[0], 10);
        const p1 = parseInt(parts[1], 10);
        const p2 = parseInt(parts[2], 10);
        if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
          let y = p2;
          let m = p1;
          if (parts[0].length === 4) {
            y = p0;
            m = p1;
          }
          const mKey = `${y}-${String(m).padStart(2, '0')}`;
          monthsMap[mKey] = `${getMonthName(m)} ${y}`;
        }
      }
    });

    return Object.keys(monthsMap)
      .sort()
      .map(key => ({
        key,
        label: monthsMap[key]
      }));
  }, [sheetData, dateCol]);

  const isTendersTab = tab === "tenders";
  const isInternalLeadsTab = tab === "internal_leads";

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
    } else if (isInternalLeadsTab) {
      // Internal Leads Section: fetched directly from Internal Leads primary sheet tab
      rows = rows;
    } else {
      // Active Leads Section: strictly exclude any row where Source is 'Tender' so they appear in Tender ONLY
      rows = rows.filter(row => !isRowTender(row));
    }

    let finalRows = rows;
    if (selectedMonth !== "All" && dateCol) {
      finalRows = rows.filter(row => {
        const dateVal = row[dateCol];
        if (!dateVal) return false;
        const d = parseDate(dateVal);
        if (!d) return false;
        const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        return mKey === selectedMonth;
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
  }, [sheetData, selectedMonth, dateCol, isTendersTab, isInternalLeadsTab, includeArchived]);

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
      { label: "Total Leads", value: totalRows.toLocaleString("en-IN"), delta: "+12%" },
      { label: "Active Leads", value: activeCount.toLocaleString("en-IN"), delta: "+4%" },
      { label: "Closed Won", value: closedWonCount.toLocaleString("en-IN"), delta: "+0%" },
      { label: "Closed Lost", value: closedLostCount.toLocaleString("en-IN"), delta: "+0%" }
    ];
  }, [filteredRows, sheetData]);

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
                  : tab === "data" 
                  ? "Data Platform" 
                  : tab === "help"
                  ? "Help"
                  : "Active Leads"}
              </h1>
              
              {sheetData && uniqueMonths.length > 0 && (
                <div className="relative">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#111118] hover:bg-gray-50 dark:hover:bg-[#1C1C2D] border border-gray-250 dark:border-[rgba(255,255,255,0.08)] text-gray-700 dark:text-white text-xs font-sans font-semibold rounded-lg transition-all cursor-pointer outline-none"
                  >
                    <option value="All">All Months</option>
                    {uniqueMonths.map(m => (
                      <option key={m.key} value={m.key}>{m.label}</option>
                    ))}
                  </select>
                </div>
              )}
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
                  delta={kpi.delta}
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
            />
          )}

          {/* Action Conversation Modal (triggered by clicking edit on any lead row) */}
          <ActionConversationModal
            isOpen={isActionModalOpen}
            onClose={() => setIsActionModalOpen(false)}
            lead={selectedActionLead}
          />
        </div>
      )}
    </DashboardShell>
  );
}


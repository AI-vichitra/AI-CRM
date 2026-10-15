"use client";

import React, { useState, useEffect } from "react";
import { SlidersHorizontal, ArrowUpDown, Edit3, Trash2, Search, X } from "lucide-react";
import ColumnManager from "./ColumnManager";

interface CRMTableProps {
  headers: string[];
  rows: Record<string, any>[];
  visibleColumns: string[];
  columnOrder: string[];
  onSaveConfig: (visible: string[], order: string[]) => Promise<void>;
  searchTerm?: string;
  onSearchChange?: (val: string) => void;
  onEdit?: (row: Record<string, any>) => void;
  onDelete?: (row: Record<string, any>) => void;
  onQuickUpdate?: (row: Record<string, any>, col: string, val: string) => Promise<void>;
  isTenderDashboard?: boolean;
  currentTab?: string;
}

const getCampaignIcon = (name: string) => {
  const norm = name.toLowerCase().trim();
  if (norm.includes("roq")) {
    return (
      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white shrink-0 shadow-md">
        <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M4 17 L10 11 L14 15 L20 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  if (norm.includes("website")) {
    return (
      <div className="w-8 h-8 rounded-full bg-pink-500 flex items-center justify-center text-white shrink-0 shadow-md">
        <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 2c5.523 0 10 4.477 10 10s-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2z" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      </div>
    );
  }
  if (norm.includes("demo")) {
    return (
      <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-white shrink-0 shadow-md">
        <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 2a8 8 0 0 0-8 8c0 5.25 8 12 8 12s8-6.75 8-12a8 8 0 0 0-8-8z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
      </div>
    );
  }
  return (
    <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0 shadow-md">
      <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
        <path d="M2 12h20" />
      </svg>
    </div>
  );
};

// Helper to parse dates like DD/MM/YYYY or DD-MM-YYYY
const parseDate = (dateVal: any): Date | null => {
  if (!dateVal) return null;
  const dateStr = String(dateVal).trim();
  if (!dateStr || dateStr === "—" || dateStr.toLowerCase() === "placeholder") return null;

  const parts = dateStr.replace(/\s+/g, "").split(/[-/.]/);
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
        return new Date(p2, p1 - 1, p0);
      }
    }
  }
  const parsed = Date.parse(dateStr);
  return isNaN(parsed) ? null : new Date(parsed);
};

// Helper to format date cleanly as YYYY-MM-DD
const formatDisplayDate = (dateVal: any): string => {
  if (!dateVal) return "—";
  const dateStr = String(dateVal).trim();
  if (!dateStr || dateStr === "—" || dateStr.toLowerCase() === "placeholder") return "—";
  
  const parsed = parseDate(dateStr);
  if (!parsed) return dateStr;
  
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, '0');
  const dd = String(parsed.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

// Helper to retrieve or generate a unique Lead ID
const getLeadId = (row: Record<string, any>): string => {
  if (row["Lead ID"]) return String(row["Lead ID"]);
  const rowNum = row._row_num;
  if (!rowNum) return "—";
  return `COG-${1000 + Number(rowNum)}`;
};

// Helper to retrieve row source value
const getRowSource = (row: Record<string, any>): string => {
  for (const [k, v] of Object.entries(row)) {
    const kLower = k.toLowerCase().trim();
    if (
      kLower === "source" || 
      kLower === "sources" || 
      kLower.includes("source") || 
      kLower.includes("lead source") ||
      kLower === "lead type" ||
      kLower.includes("lead type")
    ) {
      const val = String(v || "").trim();
      if (val) return val;
    }
  }
  return "";
};

// Helper to retrieve column value case-insensitively with alias support
const getRowVal = (row: Record<string, any>, colName: string): any => {
  if (row[colName] !== undefined && row[colName] !== null && String(row[colName]).trim() !== "") {
    return row[colName];
  }
  if (colName === "Company" && row["Company Name"]) return row["Company Name"];
  if (colName === "Company Name" && row["Company"]) return row["Company"];
  if (colName === "Status" || colName === "Lead") {
    if (row["Status"] && String(row["Status"]).trim()) return row["Status"];
    if (row["Lead"] && String(row["Lead"]).trim()) return row["Lead"];
    if (row["Lead Status"] && String(row["Lead Status"]).trim()) return row["Lead Status"];
  }
  if (colName === "Stage" || colName === "Lead Status") {
    if (row["Stage"] && String(row["Stage"]).trim()) return row["Stage"];
    if (row["Lead Status"] && String(row["Lead Status"]).trim()) return row["Lead Status"];
    if (row["Lead"] && String(row["Lead"]).trim()) return row["Lead"];
  }
  const lower = colName.toLowerCase().trim();
  for (const [k, v] of Object.entries(row)) {
    if (k.toLowerCase().trim() === lower) return v;
  }
  return "";
};

// Clean uniform row styling without color differentiation across leads
const getSourceRowClasses = (_sourceStr: string): string => {
  return "bg-white dark:bg-[#111118] hover:bg-gray-50/80 dark:hover:bg-[rgba(255,255,255,0.03)]";
};

// Helper to retrieve row status value
const getRowStatus = (row: Record<string, any>): string => {
  if (row["Status"] && String(row["Status"]).trim()) return String(row["Status"]).trim();
  if (row["Lead"] && String(row["Lead"]).trim()) return String(row["Lead"]).trim();
  if (row["Lead Status"] && String(row["Lead Status"]).trim()) return String(row["Lead Status"]).trim();
  for (const [k, v] of Object.entries(row)) {
    const kLower = k.toLowerCase().trim();
    if (kLower === "status" || kLower === "lead") {
      const val = String(v || "").trim();
      if (val) return val;
    }
  }
  return "";
};

export default function CRMTable({
  headers,
  rows,
  visibleColumns,
  columnOrder,
  onSaveConfig,
  searchTerm,
  onSearchChange,
  onEdit,
  onDelete,
  onQuickUpdate,
  isTenderDashboard,
  currentTab,
}: CRMTableProps) {
  const [localSearchTerm, setLocalSearchTerm] = useState("");
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [optimisticValues, setOptimisticValues] = useState<Record<string, string>>({});

  const handleDropdownChange = async (row: Record<string, any>, col: string, newValue: string) => {
    const rowNum = row._row_num;
    const optKey = `${rowNum}_${col}`;
    setOptimisticValues(prev => ({ ...prev, [optKey]: newValue }));
    if (onQuickUpdate) {
      try {
        await onQuickUpdate(row, col, newValue);
      } catch (err) {
        // Rollback optimistic update on failure
        setOptimisticValues(prev => {
          const next = { ...prev };
          delete next[optKey];
          return next;
        });
      }
    }
  };

  const getEffectiveVal = (row: Record<string, any>, col: string) => {
    const rowNum = row._row_num;
    const optKey = `${rowNum}_${col}`;
    if (optimisticValues[optKey] !== undefined) {
      return optimisticValues[optKey];
    }
    return String(getRowVal(row, col) ?? "");
  };

  const isNumericColumn = (colName: string) => {
    const norm = colName.toLowerCase();
    if (norm === "lead id") return false;
    return ["visitors", "contacts", "companies", "leads", "value", "amount", "revenue", "no."].some(x => norm.includes(x));
  };
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(8);

  // Dynamic Filters based on headers
  const typeColumn = headers.find(h => h.toLowerCase().includes("type") || h.toLowerCase().includes("channel"));
  const uniqueTypes = typeColumn 
    ? Array.from(new Set(rows.map(r => String(r[typeColumn] || "").trim()).filter(Boolean)))
    : [];
  const [selectedType, setSelectedType] = useState("All");

  const statusColumn = headers.find(h => h.toLowerCase() === "status") || headers.find(h => h.toLowerCase().includes("status")) || "";
  const uniqueStatuses = statusColumn 
    ? Array.from(new Set(rows.map(r => String(r[statusColumn] || "").trim()).filter(Boolean)))
    : [];
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [selectedSource, setSelectedSource] = useState("All");

  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = useState(false);
  const [selectedDetailsRow, setSelectedDetailsRow] = useState<Record<string, any> | null>(null);

  const activeSearch = searchTerm !== undefined ? searchTerm : localSearchTerm;

  // Reset pagination index on search / sort / filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [activeSearch, sortColumn, sortDirection, selectedType, selectedStatus, selectedSource]);

  // Determine active columns and order
  const displayCols = (columnOrder.length > 0 ? columnOrder : [...headers]).filter(
    (col) => col !== "Lead ID" && col.toLowerCase() !== "lead id"
  );
  const activeColsRaw = displayCols.filter((col) => {
    if (visibleColumns.length === 0) return headers.includes(col);
    // Show if it's explicitly visible, or if it's a new column not yet present in columnOrder config
    return (visibleColumns.includes(col) || (headers.includes(col) && !columnOrder.includes(col))) && headers.includes(col);
  });

  // Include missing headers that aren't in columnOrder yet
  headers.forEach((h) => {
    if (h !== "Lead ID" && h.toLowerCase() !== "lead id" && !displayCols.includes(h)) {
      displayCols.push(h);
      activeColsRaw.push(h); // Make it visible by default since it is brand new
    }
  });

  // Clean active columns and ensure Date is first if present
  const cleanedCols = activeColsRaw.filter((col) => col !== "Lead ID" && col.toLowerCase() !== "lead id");
  let activeCols = cleanedCols.includes("Date")
    ? ["Date", ...cleanedCols.filter((col) => col !== "Date")]
    : cleanedCols;
  
  // Check if we are on Active Leads tab (default tab in dashboard) or Internal Leads tab
  const isActiveLeadsTab = !isTenderDashboard && (currentTab === "active_leads" || currentTab === "dashboard" || !currentTab);
  const isInternalLeadsTab = currentTab === "internal_leads";

  if (isActiveLeadsTab || isInternalLeadsTab) {
    // Strictly display ONLY the requested columns in this exact order with Date first:
    // Date, Company Name, Requirement, Stage, Status, Cog POC
    activeCols = ["Date", "Company", "Requirement", "Stage", "Status", "Cog POC"];
  } else if (isTenderDashboard) {
    // For Tender Dashboard, remove specific columns
    activeCols = activeCols.filter(col => {
      const colLower = col.toLowerCase().trim();
      if (
        colLower === "source" || 
        colLower === "sources" || 
        colLower.includes("poc email") ||
        colLower === "email" ||
        colLower.includes("message from prospect")
      ) {
        return false;
      }
      return true;
    });
  }

  // Sorting logic
  const handleSort = (col: string) => {
    if (sortColumn === col) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(col);
      setSortDirection("asc");
    }
  };

  // Filter rows based on search and selected options
  const filteredRows = rows.filter((row) => {
    const matchesSearch = Object.values(row).some((val) =>
      String(val).toLowerCase().includes(activeSearch.toLowerCase())
    );

    let matchesType = true;
    if (typeColumn && selectedType !== "All") {
      matchesType = String(row[typeColumn] || "").trim() === selectedType;
    }

    let matchesStatus = true;
    if (selectedStatus !== "All") {
      const rowSt = getRowStatus(row).toLowerCase().trim();
      const targetSt = selectedStatus.toLowerCase().trim();
      matchesStatus = rowSt === targetSt || rowSt.includes(targetSt);
    }

    let matchesSource = true;
    if (selectedSource !== "All") {
      const rowSrc = getRowSource(row).toLowerCase().trim();
      const targetSrc = selectedSource.toLowerCase().trim();
      matchesSource = rowSrc === targetSrc || rowSrc.includes(targetSrc);
    }

    return matchesSearch && matchesType && matchesStatus && matchesSource;
  });

  // Sort filtered rows
  const sortedRows = [...filteredRows];
  if (sortColumn) {
    sortedRows.sort((a, b) => {
      let valA = getRowVal(a, sortColumn) ?? "";
      let valB = getRowVal(b, sortColumn) ?? "";
      
      const numA = parseFloat(String(valA).replace(/[^0-9.-]/g, ""));
      const numB = parseFloat(String(valB).replace(/[^0-9.-]/g, ""));
      
      if (!isNaN(numA) && !isNaN(numB)) {
        return sortDirection === "asc" ? numA - numB : numB - numA;
      }
      
      return sortDirection === "asc" 
        ? String(valA).localeCompare(String(valB)) 
        : String(valB).localeCompare(String(valA));
    });
  }

  // Slice rows for current page
  const indexOfLastRow = currentPage * rowsPerPage;
  const indexOfFirstRow = indexOfLastRow - rowsPerPage;
  const currentRows = sortedRows.slice(indexOfFirstRow, indexOfLastRow);
  const totalPages = Math.ceil(sortedRows.length / rowsPerPage);

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-[rgba(255,255,255,0.06)] bg-white dark:bg-[#111118] overflow-hidden shadow-xl transition-colors duration-150">
      {/* Table Action Bar */}
      <div className="px-5 py-4 border-b border-gray-100 dark:border-[rgba(255,255,255,0.05)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Section Title */}
        <div className="flex items-center gap-3 min-w-0">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white font-sans tracking-tight">
            Campaign Performance
          </h3>
          {(selectedSource !== "All" || selectedStatus !== "All" || selectedType !== "All") && (
            <button
              type="button"
              onClick={() => {
                setSelectedSource("All");
                setSelectedStatus("All");
                setSelectedType("All");
              }}
              className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition-colors cursor-pointer border border-rose-200 dark:border-rose-900/40"
            >
              Reset All Filters
            </button>
          )}
        </div>

        {/* Right: Controls & Filters */}
        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          {/* Type Filter */}
          {typeColumn && (
            <div className="relative">
              <button
                onClick={() => {
                  setIsTypeDropdownOpen(!isTypeDropdownOpen);
                  setIsStatusDropdownOpen(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#161622] hover:bg-gray-50 dark:hover:bg-[#1C1C2D] border border-gray-200 dark:border-[rgba(255,255,255,0.08)] text-gray-700 dark:text-white text-xs font-sans rounded-lg transition-colors cursor-pointer"
              >
                <span className="text-gray-400 dark:text-[#888899]">Type:</span>
                <span className="font-medium text-gray-900 dark:text-white">{selectedType}</span>
                <svg className={`w-3 h-3 text-gray-400 dark:text-[#888899] transition-transform duration-200 ${isTypeDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isTypeDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsTypeDropdownOpen(false)} />
                  <div className="absolute right-0 mt-1.5 w-40 bg-white dark:bg-[#161622] border border-gray-200 dark:border-[rgba(255,255,255,0.08)] rounded-xl shadow-2xl z-20 py-1 overflow-hidden">
                    <button
                      onClick={() => {
                        setSelectedType("All");
                        setIsTypeDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-sans hover:bg-gray-50 dark:hover:bg-[#1C1C2D] transition-colors cursor-pointer ${
                        selectedType === "All" ? "text-blue-600 dark:text-blue-400 font-semibold bg-gray-50/50 dark:bg-[#1C1C2D]/50" : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      All
                    </button>
                    {uniqueTypes.map(t => (
                      <button
                        key={t}
                        onClick={() => {
                          setSelectedType(t);
                          setIsTypeDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs font-sans hover:bg-gray-50 dark:hover:bg-[#1C1C2D] transition-colors cursor-pointer ${
                          selectedType === t ? "text-blue-600 dark:text-blue-400 font-semibold bg-gray-50/50 dark:bg-[#1C1C2D]/50" : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Status Filter */}
          {statusColumn && (
            <div className="relative">
              <button
                onClick={() => {
                  setIsStatusDropdownOpen(!isStatusDropdownOpen);
                  setIsTypeDropdownOpen(false);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#161622] hover:bg-gray-50 dark:hover:bg-[#1C1C2D] border border-gray-200 dark:border-[rgba(255,255,255,0.08)] text-gray-700 dark:text-white text-xs font-sans rounded-lg transition-colors cursor-pointer"
              >
                <span className="text-gray-400 dark:text-[#888899]">Status:</span>
                <span className="font-medium text-gray-900 dark:text-white">{selectedStatus}</span>
                <svg className={`w-3 h-3 text-gray-400 dark:text-[#888899] transition-transform duration-200 ${isStatusDropdownOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isStatusDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setIsStatusDropdownOpen(false)} />
                  <div className="absolute right-0 mt-1.5 w-40 bg-white dark:bg-[#161622] border border-gray-200 dark:border-[rgba(255,255,255,0.08)] rounded-xl shadow-2xl z-20 py-1 overflow-hidden">
                    <button
                      onClick={() => {
                        setSelectedStatus("All");
                        setIsStatusDropdownOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs font-sans hover:bg-gray-50 dark:hover:bg-[#1C1C2D] transition-colors cursor-pointer ${
                        selectedStatus === "All" ? "text-blue-600 dark:text-blue-400 font-semibold bg-gray-50/50 dark:bg-[#1C1C2D]/50" : "text-gray-700 dark:text-gray-300"
                      }`}
                    >
                      All
                    </button>
                    {uniqueStatuses.map(s => (
                      <button
                        key={s}
                        onClick={() => {
                          setSelectedStatus(s);
                          setIsStatusDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs font-sans hover:bg-gray-50 dark:hover:bg-[#1C1C2D] transition-colors cursor-pointer ${
                          selectedStatus === s ? "text-blue-600 dark:text-blue-400 font-semibold bg-gray-50/50 dark:bg-[#1C1C2D]/50" : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Search bar inside Table */}
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 dark:text-[#888899]" />
            <input
              type="text"
              placeholder="Search by company or stage..."
              value={activeSearch}
              onChange={(e) => {
                if (onSearchChange) {
                  onSearchChange(e.target.value);
                } else {
                  setLocalSearchTerm(e.target.value);
                }
              }}
              className="w-full pl-9 pr-4 py-1.5 text-xs bg-white dark:bg-[#161622] border border-gray-200 dark:border-[rgba(255,255,255,0.08)] hover:border-gray-350 dark:hover:border-[rgba(255,255,255,0.15)] focus:border-blue-500 rounded-lg text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-[#555566] transition-all outline-none font-sans"
            />
          </div>

          {/* Configure Columns Trigger */}
          {!isActiveLeadsTab && !isInternalLeadsTab && (
            <button
              onClick={() => setIsManagerOpen(true)}
              className="p-1.5 bg-white hover:bg-gray-50 dark:bg-[#161622] dark:hover:bg-[#1C1C2D] border border-gray-200 dark:border-[rgba(255,255,255,0.08)] text-gray-500 dark:text-[#888899] hover:text-gray-900 dark:hover:text-white rounded-lg transition-colors cursor-pointer"
              title="Configure Columns"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Grid Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#161622]/40 text-[10px] font-sans font-semibold uppercase tracking-wider text-gray-500 dark:text-[#888899]">
              {activeCols.map((col, idx) => {
                const isRight = isNumericColumn(col) && col.toLowerCase() !== "no.";
                const colLabel = col === "Company" ? "Company Name" : col;
                return (
                  <th 
                    key={`${col}-${idx}`} 
                    className={`py-3 px-4 select-none cursor-pointer hover:bg-gray-150/50 dark:hover:bg-[rgba(255,255,255,0.03)] hover:text-gray-950 dark:hover:text-white transition-colors ${
                      isRight ? "text-right" : "text-left"
                    }`}
                    onClick={() => handleSort(col)}
                  >
                    <div className={`flex items-center gap-1 ${isRight ? "justify-end" : "justify-start"}`}>
                      {colLabel}
                      <ArrowUpDown className="w-3 h-3 text-[#555566]" />
                    </div>
                  </th>
                );
              })}
              {(onEdit || onDelete) && (
                <th className="py-3 px-4 font-semibold text-center select-none text-[10px] tracking-wider text-gray-500 dark:text-[#888899] w-24">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {currentRows.length > 0 ? (
              currentRows.map((row, rowIdx) => {
                const rowSource = getRowSource(row);
                const rowClass = getSourceRowClasses(rowSource);
                return (
                  <tr 
                    key={rowIdx}
                    className={`border-b border-gray-200/60 dark:border-white/5 last:border-0 transition-colors duration-150 text-xs font-sans text-gray-900 dark:text-gray-100 row-fade-in ${rowClass}`}
                    style={{ animationDelay: `${rowIdx * 30}ms` }}
                  >
                  {activeCols.map((col, idx) => {
                    const cellVal = String(getRowVal(row, col) ?? "");
                    const isNo = col.toLowerCase() === "no.";
                    const isCampaign = col.toLowerCase() === "campaign";
                    const isValue = ["value", "amount", "revenue", "estimations", "deal size"].some(x => col.toLowerCase().includes(x));

                    if (isCampaign) {
                      const parts = cellVal.split("\n");
                      const mainTitle = parts[0];
                      const subtitle = parts[1] || "";
                      return (
                        <td key={`${col}-${idx}`} className="py-3 px-4 text-left">
                          <div className="flex items-center gap-3">
                            {getCampaignIcon(mainTitle)}
                            <div className="flex flex-col">
                              <span className="font-semibold text-gray-900 dark:text-white text-xs">{mainTitle}</span>
                              {subtitle && <span className="text-[10px] text-gray-400 dark:text-[#555566] mt-0.5">{subtitle}</span>}
                            </div>
                          </div>
                        </td>
                      );
                    }

                    const isRight = isNumericColumn(col) && col.toLowerCase() !== "no.";
                    
                    // Render formatted cells
                    const renderCellContent = () => {
                      if (col.toLowerCase().includes("company")) {
                        return (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSelectedDetailsRow(row)}
                              className="font-bold text-gray-900 dark:text-white hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors text-left cursor-pointer"
                            >
                              {cellVal}
                            </button>
                          </div>
                        );
                      }
                      if (isValue) {
                        // Apply currency formatting prefix if not already present
                        const cleanVal = cellVal.replace(/[₹$,\s]/g, "");
                        const numericVal = parseFloat(cleanVal);
                        const formatted = !isNaN(numericVal) 
                          ? `₹${numericVal.toLocaleString("en-IN")}`
                          : cellVal;
                        return (
                          <span className="font-semibold text-emerald-600 dark:text-[#3cd395] font-mono">
                            {formatted || "—"}
                          </span>
                        );
                      }
                      
                      const colLower = col.toLowerCase().trim();
                      const isStatus = colLower === "status" || colLower.includes("status");
                      const isStage = colLower === "stage" || colLower.includes("stage");
                      const isType = colLower.includes("type");
                      const isSource = colLower.includes("source");
                      const isDate = colLower.includes("date") || colLower.includes("deadline") || colLower.includes("due");

                      if (isDate && cellVal.trim() !== "") {
                        return (
                          <span className="font-mono text-gray-700 dark:text-[#dedee5]">
                            {formatDisplayDate(cellVal)}
                          </span>
                        );
                      }

                      if (isSource && cellVal.trim() !== "" && cellVal.length <= 25) {
                        return (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wide uppercase bg-white/80 dark:bg-black/40 border border-black/15 dark:border-white/20 shadow-xs">
                            {cellVal}
                          </span>
                        );
                      }

                      // Interactive Stage dropdown (Image 3)
                      if (isStage) {
                        const effectiveVal = getEffectiveVal(row, col).trim();
                        const stageOptions = [
                          "Lead",
                          "Contacted",
                          "Proposal sent",
                          "Proposal to be Sent",
                          "Negotiation",
                          "Won",
                          "Lost",
                        ];
                        const matchedOpt = stageOptions.find(o => o.toLowerCase() === effectiveVal.toLowerCase());
                        const selectVal = matchedOpt || effectiveVal;
                        const hasCustom = effectiveVal !== "" && !matchedOpt;

                        return (
                          <select
                            value={selectVal}
                            onChange={(e) => handleDropdownChange(row, col, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full min-w-[130px] max-w-[175px] bg-white dark:bg-[#161622] text-gray-800 dark:text-gray-200 border border-gray-250 dark:border-white/10 rounded-lg px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-xs hover:border-gray-400 dark:hover:border-white/20 transition-all"
                          >
                            <option value="">-- Select Stage --</option>
                            {stageOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                            {hasCustom && (
                              <option value={effectiveVal}>{effectiveVal}</option>
                            )}
                          </select>
                        );
                      }

                      // Interactive Status dropdown (Image 4)
                      if (isStatus) {
                        const effectiveVal = getEffectiveVal(row, col).trim();
                        const statusOptions = [
                          "Hot",
                          "Warm",
                          "Cold",
                        ];
                        const matchedOpt = statusOptions.find(o => o.toLowerCase() === effectiveVal.toLowerCase());
                        const selectVal = matchedOpt || effectiveVal;
                        const hasCustom = effectiveVal !== "" && !matchedOpt;

                        return (
                          <select
                            value={selectVal}
                            onChange={(e) => handleDropdownChange(row, col, e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full min-w-[120px] max-w-[155px] bg-white dark:bg-[#161622] text-gray-800 dark:text-gray-200 border border-gray-250 dark:border-white/10 rounded-lg px-2.5 py-1 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer shadow-xs hover:border-gray-400 dark:hover:border-white/20 transition-all"
                          >
                            <option value="">-- Select Status --</option>
                            {statusOptions.map((opt) => (
                              <option key={opt} value={opt}>
                                {opt}
                              </option>
                            ))}
                            {hasCustom && (
                              <option value={effectiveVal}>{effectiveVal}</option>
                            )}
                          </select>
                        );
                      }
                      
                      // Render type as Indigo/Purple badge
                      if (isType && cellVal.trim() !== "" && cellVal.length <= 20) {
                        const valLower = cellVal.toLowerCase().trim();
                        let badgeClass = "bg-purple-50 text-purple-700 border border-purple-100 dark:bg-purple-500/10 dark:text-purple-400 dark:border-purple-500/20";
                        if (valLower.includes("inbound")) {
                          badgeClass = "bg-indigo-50 text-indigo-700 border border-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20";
                        }
                        return (
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold leading-none ${badgeClass}`}>
                            {cellVal}
                          </span>
                        );
                      }

                      // Truncate long notes or description texts
                      if (cellVal.length > 25) {
                        return (
                          <span className="block truncate max-w-[220px] text-gray-700 dark:text-[#dedee5] cursor-help" title={cellVal}>
                            {cellVal}
                          </span>
                        );
                      }
                      
                      return cellVal;
                    };

                    return (
                      <td 
                        key={`${col}-${idx}`} 
                        className={`py-3 px-4 text-xs ${
                          isNo ? "text-gray-400 dark:text-[#555566] font-mono" : "text-gray-800 dark:text-[#dedee5]"
                        } ${
                          isRight ? "text-right" : "text-left"
                        }`}
                      >
                        {renderCellContent()}
                      </td>
                    );
                  })}
                  {(onEdit || onDelete) && (
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {onEdit && (
                          <button
                            onClick={() => onEdit(row)}
                            className="p-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 dark:bg-emerald-500/10 dark:border-emerald-500/20 text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 rounded transition-colors cursor-pointer"
                            title="Edit Lead"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            onClick={() => onDelete(row)}
                            className="p-1 bg-red-50 hover:bg-red-100 border border-red-250 dark:bg-red-500/10 dark:border-red-500/20 text-rose-600 hover:text-rose-500 dark:text-rose-450 rounded transition-colors cursor-pointer"
                            title="Delete Lead"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={(activeCols.length + ((onEdit || onDelete) ? 1 : 0)) || 1} className="py-12 text-center text-[#555566] text-sm font-sans">
                  No records match your query
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Footer statistics & Pagination controls */}
      <div className="p-4 bg-gray-50/50 dark:bg-[rgba(255,255,255,0.01)] border-t border-gray-100 dark:border-[rgba(255,255,255,0.05)] flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-gray-500 dark:text-[#888899] font-sans">
        <div className="flex items-center gap-4">
          <span>
            Showing {sortedRows.length > 0 ? indexOfFirstRow + 1 : 0} to{" "}
            {Math.min(indexOfLastRow, sortedRows.length)} of {sortedRows.length}{" "}
            entries
          </span>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-[#555566]">Per Page:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-1.5 py-0.5 bg-gray-100 dark:bg-[#161622] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] rounded text-gray-900 dark:text-white font-sans outline-none cursor-pointer text-[10px]"
            >
              {[5, 8, 12, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-250 dark:bg-[#161622] dark:hover:bg-[#1C1C2D] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] text-gray-900 dark:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors text-[10px]"
            >
              Prev
            </button>
            
            {Array.from({ length: totalPages }).map((_, idx) => {
              const pNum = idx + 1;
              if (
                totalPages > 6 &&
                pNum !== 1 &&
                pNum !== totalPages &&
                Math.abs(pNum - currentPage) > 1
              ) {
                if (pNum === 2 && currentPage > 3) {
                  return <span key="ellipsis-start" className="px-1 text-[#555566]">...</span>;
                }
                if (pNum === totalPages - 1 && currentPage < totalPages - 2) {
                  return <span key="ellipsis-end" className="px-1 text-[#555566]">...</span>;
                }
                return null;
              }

              return (
                <button
                  key={pNum}
                  onClick={() => setCurrentPage(pNum)}
                  className={`px-2.5 py-1 rounded border text-[10px] cursor-pointer transition-colors ${
                    currentPage === pNum
                      ? "bg-[#1E3A8A] border-[#1E3A8A] text-white font-bold"
                      : "bg-gray-100 hover:bg-gray-200 dark:bg-[#161622] dark:hover:bg-[#1C1C2D] border-gray-200 dark:border-[rgba(255,255,255,0.06)] text-gray-800 dark:text-white"
                  }`}
                >
                  {pNum}
                </button>
              );
            })}

            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-2 py-1 rounded bg-gray-100 hover:bg-gray-250 dark:bg-[#161622] dark:hover:bg-[#1C1C2D] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] text-gray-900 dark:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer transition-colors text-[10px]"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Column Manager Drawer */}
      <ColumnManager
        isOpen={isManagerOpen}
        onClose={() => setIsManagerOpen(false)}
        allHeaders={headers}
        visibleColumns={visibleColumns}
        columnOrder={columnOrder}
        onSave={onSaveConfig}
      />

      {/* Lead Details Modal */}
      {selectedDetailsRow && (() => {
        const companyName = getRowVal(selectedDetailsRow, "Company") || getRowVal(selectedDetailsRow, "Company Name") || "Lead Details";
        const leadId = getLeadId(selectedDetailsRow);
        const sNo = selectedDetailsRow["S. No."] || selectedDetailsRow["S. No. "] || selectedDetailsRow["No."] || "";
        const rowSource = selectedDetailsRow["Lead Source"] || selectedDetailsRow["Lead Type"] || getRowSource(selectedDetailsRow) || "—";
        const rowStatus = getRowStatus(selectedDetailsRow);
        const rawDate = getRowVal(selectedDetailsRow, "Date") || "";
        const dateVal = formatDisplayDate(rawDate);
        const pocName = selectedDetailsRow["POC Name"] || selectedDetailsRow["Name"] || "—";
        const contactNo = selectedDetailsRow["Contact No."] || selectedDetailsRow["Phone"] || "—";
        const emailVal = selectedDetailsRow["Email Id"] || selectedDetailsRow["Email"] || "—";
        const requirement = getRowVal(selectedDetailsRow, "Requirement") || "—";
        const stageVal = getRowVal(selectedDetailsRow, "Stage") || "—";
        const cogPoc = getRowVal(selectedDetailsRow, "Cog POC") || "—";
        const cogPocEmail = selectedDetailsRow["POC email"] || selectedDetailsRow["Cog POC Email"] || "";
        const remarks = selectedDetailsRow["Remarks /Updates"] || selectedDetailsRow["Last Update"] || "—";
        const messageFromProspect = selectedDetailsRow["Message from Prospect"] || "";
        const revenueEst =
          selectedDetailsRow["Revenue Estimation (In INR) (Oct 26 - Mar 27)"] ||
          selectedDetailsRow["Revenue Estimations"] ||
          selectedDetailsRow["Revenue Estimation"] ||
          "—";
        const retainerCost =
          selectedDetailsRow["Retainer Cost"] ||
          selectedDetailsRow["Retainer cost"] ||
          "—";

        // Collect any extra sheet fields not already rendered in the main modal sections
        const coreKeys = new Set([
          "Company", "Company Name", "Lead ID", "Source", "Lead Source", "Sources",
          "Status", "Date", "POC Name", "Name", "Contact No.", "Phone",
          "Email Id", "Email", "Requirement", "Stage", "Cog POC",
          "Remarks /Updates", "Last Update",
          "Revenue Estimation (In INR) (Oct 26 - Mar 27)", "Revenue Estimations", "Revenue Estimation",
          "Retainer Cost", "Retainer cost",
          "S. No.", "S. No. ", "No.",
        ]);
        if (cogPocEmail) {
          coreKeys.add("POC email");
          coreKeys.add("Cog POC Email");
        }
        if (messageFromProspect) {
          coreKeys.add("Message from Prospect");
        }

        const extraFields = Object.entries(selectedDetailsRow).filter(([k, v]) => {
          if (k.startsWith("_")) return false;
          if (coreKeys.has(k)) return false;
          return String(v || "").trim() !== "";
        });

        return (
          <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 transition-opacity" onClick={() => setSelectedDetailsRow(null)} />
            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl bg-white dark:bg-[#111118] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[88vh]">
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-white/10 flex items-center justify-between bg-gray-50/50 dark:bg-[#161622]/50">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-sm">
                    {companyName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-white font-sans">
                        {companyName}
                      </h3>
                      {sNo && (
                        <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-white/5 dark:text-gray-300 border border-gray-200 dark:border-white/10">
                          S. No. {sNo}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-semibold text-gray-500 dark:text-[#888899]">
                      Source / Type: {rowSource}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedDetailsRow(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-100 hover:bg-gray-200 dark:bg-[#1C1C2D] dark:hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-5">
                {/* Quick Summary Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 p-3.5 rounded-xl bg-gray-50 dark:bg-[#161622]/60 border border-gray-100 dark:border-white/5">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-gray-400 dark:text-[#888899]">Date</span>
                    <p className="text-xs font-semibold text-gray-900 dark:text-white mt-0.5 font-mono" title={rawDate}>{dateVal}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-gray-400 dark:text-[#888899]">Source / Type</span>
                    <p className="text-xs font-semibold text-gray-900 dark:text-white mt-0.5">{rowSource}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-gray-400 dark:text-[#888899]">Status</span>
                    <p className="text-xs font-semibold text-gray-900 dark:text-white mt-0.5">{rowStatus || "—"}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-gray-400 dark:text-[#888899]">Stage</span>
                    <p className="text-xs font-semibold text-gray-900 dark:text-white mt-0.5">{stageVal}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-mono uppercase text-gray-400 dark:text-[#888899]">Cog POC</span>
                    <p className="text-xs font-semibold text-gray-900 dark:text-white mt-0.5">{cogPoc}</p>
                    {cogPocEmail && (
                      <p className="text-[9px] text-gray-400 dark:text-[#888899] font-mono truncate mt-0.5" title={cogPocEmail}>
                        {cogPocEmail}
                      </p>
                    )}
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <h4 className="text-xs font-bold text-gray-400 dark:text-[#888899] uppercase tracking-wider font-mono mb-2.5">
                    Contact Details
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
                      <span className="text-[10px] text-gray-400 font-mono uppercase">POC Name</span>
                      <p className="text-xs font-semibold text-gray-900 dark:text-white mt-0.5">{pocName}</p>
                    </div>
                    <div className="p-3 rounded-xl border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
                      <span className="text-[10px] text-gray-400 font-mono uppercase">Contact No.</span>
                      <p className="text-xs font-semibold text-gray-900 dark:text-white mt-0.5 font-mono">{contactNo}</p>
                    </div>
                    <div className="p-3 rounded-xl border border-gray-100 dark:border-white/5 bg-gray-50/50 dark:bg-white/[0.02]">
                      <span className="text-[10px] text-gray-400 font-mono uppercase">Email Id</span>
                      <p className="text-xs font-semibold text-gray-900 dark:text-white mt-0.5 break-all">{emailVal}</p>
                    </div>
                  </div>
                </div>

                {/* Revenue Estimation & Retainer Cost */}
                <div>
                  <h4 className="text-xs font-bold text-gray-400 dark:text-[#888899] uppercase tracking-wider font-mono mb-2.5">
                    Commercials & Revenue Estimation
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-xl border border-emerald-200/60 dark:border-emerald-500/20 bg-emerald-50/40 dark:bg-emerald-500/[0.04]">
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-mono uppercase font-semibold">
                        Revenue Estimation
                      </span>
                      <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mt-1 font-mono">
                        {revenueEst !== "—" && !String(revenueEst).startsWith("₹") ? `₹${revenueEst}` : revenueEst}
                      </p>
                    </div>
                    <div className="p-3.5 rounded-xl border border-indigo-200/60 dark:border-indigo-500/20 bg-indigo-50/40 dark:bg-indigo-500/[0.04]">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-indigo-700 dark:text-indigo-400 font-mono uppercase font-semibold">
                          Retainer Cost
                        </span>
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 uppercase tracking-wide">
                          Monthly
                        </span>
                      </div>
                      <p className="text-sm font-bold text-indigo-700 dark:text-indigo-300 mt-1 font-mono">
                        {(() => {
                          if (retainerCost === "—" || !retainerCost) return "—";
                          const str = String(retainerCost).trim();
                          if (/^\d{4}[-/.]\d{1,2}/.test(str)) return str;
                          return str.startsWith("₹") ? str : `₹${str}`;
                        })()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Requirement & Remarks */}
                <div className="space-y-3">
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 dark:text-[#888899] uppercase tracking-wider font-mono">
                      Requirement
                    </span>
                    <p className="mt-1 p-3 text-xs text-gray-800 dark:text-gray-200 bg-gray-50/60 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-xl leading-relaxed whitespace-pre-wrap">
                      {requirement}
                    </p>
                  </div>
                  {messageFromProspect && (
                    <div>
                      <span className="text-[10px] font-bold text-gray-400 dark:text-[#888899] uppercase tracking-wider font-mono">
                        Message from Prospect
                      </span>
                      <p className="mt-1 p-3 text-xs text-gray-800 dark:text-gray-200 bg-gray-50/60 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-xl leading-relaxed whitespace-pre-wrap">
                        {messageFromProspect}
                      </p>
                    </div>
                  )}
                  <div>
                    <span className="text-[10px] font-bold text-gray-400 dark:text-[#888899] uppercase tracking-wider font-mono">
                      Remarks / Updates
                    </span>
                    <p className="mt-1 p-3 text-xs text-gray-800 dark:text-gray-200 bg-gray-50/60 dark:bg-white/[0.02] border border-gray-100 dark:border-white/5 rounded-xl leading-relaxed whitespace-pre-wrap">
                      {remarks}
                    </p>
                  </div>
                </div>

                {/* Additional Details */}
                {extraFields.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 dark:text-[#888899] uppercase tracking-wider font-mono mb-2.5">
                      Additional Sheet Info
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {extraFields.map(([key, val]) => (
                        <div key={key} className="p-2.5 rounded-xl border border-gray-100 dark:border-white/5 bg-gray-50/40 dark:bg-white/[0.01]">
                          <span className="text-[10px] font-mono text-gray-400 uppercase">{key}</span>
                          <p className="text-xs text-gray-800 dark:text-gray-200 mt-0.5 break-words whitespace-pre-wrap">{String(val)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        );
      })()}
    </div>
  );
}

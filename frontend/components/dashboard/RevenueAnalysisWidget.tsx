"use client";

import React, { useState, useEffect } from "react";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { SheetData } from "@/lib/types";

interface RevenueAnalysisWidgetProps {
  sheetData: SheetData;
}

const COLORS = {
  won: "#1D9E75", // Green
  lost: "#EF4444", // Red
};

const MOCK_REVENUE_DATA = [
  { name: "Jan", "Won Revenue": 45000, "Lost Revenue": 12000 },
  { name: "Feb", "Won Revenue": 62000, "Lost Revenue": 8000 },
  { name: "Mar", "Won Revenue": 55000, "Lost Revenue": 22000 },
  { name: "Apr", "Won Revenue": 89000, "Lost Revenue": 15000 },
  { name: "May", "Won Revenue": 104000, "Lost Revenue": 31000 },
];

const CustomRevenueTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const formatCurrency = (val: number) => {
      return new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
      }).format(val);
    };

    return (
      <div className="bg-[#0C0C12] border border-[rgba(255,255,255,0.08)] rounded-lg p-2.5 shadow-2xl font-sans text-xs">
        <p className="text-[#888899] mb-1.5 font-mono">{payload[0].payload.name}</p>
        <div className="space-y-1.5 font-mono">
          {payload.map((item: any, index: number) => {
            const isWon = item.name.toLowerCase().includes("won");
            const color = isWon ? "#1D9E75" : "#EF4444";
            return (
              <p key={index} style={{ color }} className="font-semibold flex items-center gap-4">
                <span>{item.name}:</span>
                <span>{formatCurrency(item.value)}</span>
              </p>
            );
          })}
        </div>
      </div>
    );
  }
  return null;
};

export default function RevenueAnalysisWidget({ sheetData }: RevenueAnalysisWidgetProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isMock = sheetData.is_mock;

  // Resolve estimated revenue column
  const revenueHeader = sheetData.headers.find(h => {
    const hl = h.toLowerCase();
    return hl.includes("estimated") || hl.includes("est") || hl.includes("revenue") || hl.includes("estimation");
  }) || sheetData.headers.find(h => {
    const hl = h.toLowerCase();
    return hl.includes("value") || hl.includes("amount") || hl.includes("deal size");
  }) || "";

  const statusHeader = sheetData.headers.find(h => h.toLowerCase() === "status") || "";
  const stageHeader = sheetData.headers.find(h => h.toLowerCase() === "stage") || "";
  const dateHeader = sheetData.headers.find(h => h.toLowerCase().includes("date")) || "";

  // Parse total won/lost/estimated revenues
  let wonRevenue = 0;
  let lostRevenue = 0;
  let totalEstimatedRevenue = 0;
  let hotRevenue = 0;
  let warmRevenue = 0;
  let coldRevenue = 0;
  let discoveryRevenue = 0;
  const monthlyDataMap: Record<string, { won: number; lost: number }> = {};
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const parseRevenueValue = (raw: any): number => {
    if (raw === undefined || raw === null) return 0;
    const str = String(raw).trim();
    if (!str || str === "—" || str === "-") return 0;

    // Handles expressions like "10,00,000 + 27,00,000 (4,50,000 X 6)"
    // or "21,00,000 (12,00,000 + 9,00,000)"
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

  if (!isMock && sheetData.rows) {
    sheetData.rows.forEach(row => {
      let revVal = 0;
      if (revenueHeader && row[revenueHeader] !== undefined && row[revenueHeader] !== "") {
        revVal = parseRevenueValue(row[revenueHeader]);
      } else {
        for (const [k, v] of Object.entries(row)) {
          const kl = k.toLowerCase();
          if (kl.includes("revenue") || kl.includes("estimation") || kl.includes("value") || kl.includes("amount")) {
            revVal = parseRevenueValue(v);
            if (revVal > 0) break;
          }
        }
      }
      
      totalEstimatedRevenue += revVal;

      // Safely resolve status value across Status and Lead columns
      let statusVal = "";
      if (row["Status"] && String(row["Status"]).trim()) {
        statusVal = String(row["Status"]).toLowerCase().trim();
      } else if (row["Lead"] && String(row["Lead"]).trim()) {
        statusVal = String(row["Lead"]).toLowerCase().trim();
      } else {
        for (const key of Object.keys(row)) {
          const kl = key.toLowerCase();
          if (kl === "status" || kl === "lead") {
            const val = String(row[key] || "").toLowerCase().trim();
            if (["hot", "warm", "cold", "discovery", "won", "dead"].includes(val)) {
              statusVal = val;
              break;
            }
          }
        }
      }
      if (!statusVal) {
        statusVal = String(row[statusHeader] || "").toLowerCase().trim();
      }

      const stageVal = String(row["Stage"] || row["Lead Status"] || row[stageHeader] || "").toLowerCase().trim();

      const isWon = ["won", "closed won", "converted", "completed", "hired", "success"].some(x => statusVal.includes(x) || stageVal.includes(x));
      const isLost = ["lost", "dead", "lost lead", "dead lead", "cold"].some(x => statusVal.includes(x) || stageVal.includes(x));

      if (isWon) {
        wonRevenue += revVal;
      } else if (isLost) {
        lostRevenue += revVal;
      }

      // Classify hot, warm, cold, discovery
      const isHot = statusVal === "hot";
      const isWarm = statusVal === "warm";
      const isCold = statusVal === "cold" || statusVal === "dead lead" || statusVal === "dead";
      const isDiscovery = statusVal === "discovery";

      if (isHot) {
        hotRevenue += revVal;
      } else if (isWarm) {
        warmRevenue += revVal;
      } else if (isCold) {
        coldRevenue += revVal;
      } else if (isDiscovery) {
        discoveryRevenue += revVal;
      }

      // Group by month for chart representation
      if (dateHeader) {
        const dateVal = String(row[dateHeader] || "");
        let monthName = "Other";
        const parts = dateVal.split(/[-/.]/);
        if (parts.length === 3) {
          let monthIdx = -1;
          // check YYYY-MM-DD
          if (parts[0].length === 4) {
            monthIdx = parseInt(parts[1], 10) - 1;
          } else {
            monthIdx = parseInt(parts[1], 10) - 1; // assume middle is month in DD/MM/YYYY
          }
          if (monthIdx >= 0 && monthIdx < 12) {
            monthName = MONTHS[monthIdx];
          }
        }
        
        if (monthName !== "Other") {
          if (!monthlyDataMap[monthName]) {
            monthlyDataMap[monthName] = { won: 0, lost: 0 };
          }
          if (isWon) monthlyDataMap[monthName].won += revVal;
          if (isLost) monthlyDataMap[monthName].lost += revVal;
        }
      }
    });
  }

  // Set totals for mock data
  if (isMock) {
    wonRevenue = MOCK_REVENUE_DATA.reduce((acc, curr) => acc + curr["Won Revenue"], 0);
    lostRevenue = MOCK_REVENUE_DATA.reduce((acc, curr) => acc + curr["Lost Revenue"], 0);
    totalEstimatedRevenue = wonRevenue + lostRevenue + 190000;
    hotRevenue = wonRevenue + 50000;
    coldRevenue = lostRevenue + 30000;
    discoveryRevenue = 40000;
    warmRevenue = totalEstimatedRevenue - hotRevenue - coldRevenue - discoveryRevenue;
  }

  // Count leads by status/temperature
  let hotCount = 0;
  let warmCount = 0;
  let coldCount = 0;
  let discoveryCount = 0;
  const totalRowsCount = sheetData.rows ? sheetData.rows.length : 0;

  if (sheetData.rows) {
    sheetData.rows.forEach(row => {
      let statusVal = "";
      for (const key of Object.keys(row)) {
        if (key.toLowerCase().includes("status")) {
          const val = String(row[key] || "").toLowerCase().trim();
          if (["hot", "warm", "cold", "discovery", "dead"].includes(val)) {
            statusVal = val;
            break;
          }
        }
      }
      if (!statusVal) {
        statusVal = String(row[statusHeader] || "").toLowerCase().trim();
      }

      if (statusVal === "hot") hotCount++;
      else if (statusVal === "warm") warmCount++;
      else if (statusVal === "cold" || statusVal === "dead") coldCount++;
      else if (statusVal === "discovery") discoveryCount++;
    });
  }

  const hasRevenueData = totalEstimatedRevenue > 0;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: val % 1 === 0 ? 0 : 2,
    }).format(val);
  };

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
        {/* Row 1, Col 1: Total Estimated Revenue */}
        <div className="py-2.5 px-3.5 rounded-2xl border border-gray-200/90 dark:border-white/10 bg-white dark:bg-[#111118] flex flex-col justify-between shadow-xs transition-all min-h-[68px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-gray-500 dark:text-[#888899] uppercase tracking-wider font-sans truncate">
              {hasRevenueData ? "TOTAL EST. REVENUE" : "ACTIVE PIPELINE"}
            </span>
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 font-mono px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-500/10 shrink-0">
              Live
            </span>
          </div>
          <div className="mt-1 flex items-center">
            <span
              className="text-sm sm:text-base font-bold text-gray-900 dark:text-white font-sans tracking-tight truncate block"
              title={hasRevenueData ? formatCurrency(totalEstimatedRevenue) : `${totalRowsCount} Leads`}
            >
              {hasRevenueData ? formatCurrency(totalEstimatedRevenue) : `${totalRowsCount} Leads`}
            </span>
          </div>
        </div>

        {/* Row 1, Col 2: Hot Leads */}
        <div className="py-2.5 px-3.5 rounded-2xl border border-red-200/70 dark:border-red-900/30 bg-[#FFF5F5] dark:bg-red-950/20 flex flex-col justify-between shadow-xs transition-all min-h-[68px]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-[#FF1744] shrink-0 animate-[pulse_0.8s_ease-in-out_infinite]" />
              <span className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">Hot Leads</span>
            </div>
            {hotCount > 0 && (
              <span className="text-xs font-mono text-gray-400 dark:text-[#777788] shrink-0">({hotCount})</span>
            )}
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <span
              className="text-sm sm:text-base font-bold text-gray-900 dark:text-white font-sans tracking-tight truncate shrink-0"
              title={hasRevenueData ? formatCurrency(hotRevenue) : `${hotCount} Leads`}
            >
              {hasRevenueData ? formatCurrency(hotRevenue) : `${hotCount} Leads`}
            </span>
            <div className="flex items-center gap-2 flex-1 max-w-[130px]">
              <div className="w-full bg-gray-200/80 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#FF1744] h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      hasRevenueData
                        ? totalEstimatedRevenue > 0
                          ? (hotRevenue / totalEstimatedRevenue) * 100
                          : 0
                        : totalRowsCount > 0
                        ? (hotCount / totalRowsCount) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
              <span className="text-[10px] text-gray-400 dark:text-[#888899] font-mono shrink-0">
                {hasRevenueData
                  ? totalEstimatedRevenue > 0
                    ? ((hotRevenue / totalEstimatedRevenue) * 100).toFixed(1)
                    : 0
                  : totalRowsCount > 0
                  ? ((hotCount / totalRowsCount) * 100).toFixed(1)
                  : 0}
                %
              </span>
            </div>
          </div>
        </div>

        {/* Row 1, Col 3: Warm Leads */}
        <div className="py-2.5 px-3.5 rounded-2xl border border-amber-200/70 dark:border-amber-900/30 bg-[#FEFDF0] dark:bg-amber-950/20 flex flex-col justify-between shadow-xs transition-all min-h-[68px]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-[#FFD600] shrink-0" />
              <span className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">Warm Leads</span>
            </div>
            {warmCount > 0 && (
              <span className="text-xs font-mono text-gray-400 dark:text-[#777788] shrink-0">({warmCount})</span>
            )}
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <span
              className="text-sm sm:text-base font-bold text-gray-900 dark:text-white font-sans tracking-tight truncate shrink-0"
              title={hasRevenueData ? formatCurrency(warmRevenue) : `${warmCount} Leads`}
            >
              {hasRevenueData ? formatCurrency(warmRevenue) : `${warmCount} Leads`}
            </span>
            <div className="flex items-center gap-2 flex-1 max-w-[130px]">
              <div className="w-full bg-gray-200/80 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#FFD600] h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      hasRevenueData
                        ? totalEstimatedRevenue > 0
                          ? (warmRevenue / totalEstimatedRevenue) * 100
                          : 0
                        : totalRowsCount > 0
                        ? (warmCount / totalRowsCount) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
              <span className="text-[10px] text-gray-400 dark:text-[#888899] font-mono shrink-0">
                {hasRevenueData
                  ? totalEstimatedRevenue > 0
                    ? ((warmRevenue / totalEstimatedRevenue) * 100).toFixed(1)
                    : 0
                  : totalRowsCount > 0
                  ? ((warmCount / totalRowsCount) * 100).toFixed(1)
                  : 0}
                %
              </span>
            </div>
          </div>
        </div>

        {/* Row 2, Col 1: Won Revenue */}
        <div className="py-2.5 px-3.5 rounded-2xl border border-emerald-200/80 dark:border-emerald-900/30 bg-[#F0FDF4] dark:bg-emerald-950/20 flex flex-col justify-between shadow-xs transition-all min-h-[68px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-gray-800 dark:text-gray-200 uppercase tracking-wider font-sans truncate">
              WON REVENUE
            </span>
            <span className="text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-[#DCFCE7] dark:bg-emerald-500/15 text-[#16A34A] dark:text-[#3CD395] shrink-0">
              {totalEstimatedRevenue > 0
                ? `${((wonRevenue / totalEstimatedRevenue) * 100).toFixed(0)}%`
                : totalRowsCount > 0
                ? `${Math.round(((hotCount + warmCount) / totalRowsCount) * 100)}%`
                : "0%"}
            </span>
          </div>
          <div className="mt-1 flex items-center">
            <span
              className="text-sm sm:text-base font-bold font-sans tracking-tight text-[#16A34A] dark:text-[#3CD395] truncate block"
              title={hasRevenueData ? `+${formatCurrency(wonRevenue)}` : `${hotCount + warmCount} Leads`}
            >
              {hasRevenueData ? `+${formatCurrency(wonRevenue)}` : `${hotCount + warmCount} Leads`}
            </span>
          </div>
        </div>

        {/* Row 2, Col 2: Cold Leads */}
        <div className="py-2.5 px-3.5 rounded-2xl border border-cyan-200/70 dark:border-cyan-900/30 bg-[#F0FDFA] dark:bg-cyan-950/20 flex flex-col justify-between shadow-xs transition-all min-h-[68px]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-[#00E5FF] shrink-0" />
              <span className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">Cold Leads</span>
            </div>
            {coldCount > 0 && (
              <span className="text-xs font-mono text-gray-400 dark:text-[#777788] shrink-0">({coldCount})</span>
            )}
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <span
              className="text-sm sm:text-base font-bold text-gray-900 dark:text-white font-sans tracking-tight truncate shrink-0"
              title={hasRevenueData ? formatCurrency(coldRevenue) : `${coldCount} Leads`}
            >
              {hasRevenueData ? formatCurrency(coldRevenue) : `${coldCount} Leads`}
            </span>
            <div className="flex items-center gap-2 flex-1 max-w-[130px]">
              <div className="w-full bg-gray-200/80 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#00E5FF] h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      hasRevenueData
                        ? totalEstimatedRevenue > 0
                          ? (coldRevenue / totalEstimatedRevenue) * 100
                          : 0
                        : totalRowsCount > 0
                        ? (coldCount / totalRowsCount) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
              <span className="text-[10px] text-gray-400 dark:text-[#888899] font-mono shrink-0">
                {hasRevenueData
                  ? totalEstimatedRevenue > 0
                    ? ((coldRevenue / totalEstimatedRevenue) * 100).toFixed(1)
                    : 0
                  : totalRowsCount > 0
                  ? ((coldCount / totalRowsCount) * 100).toFixed(1)
                  : 0}
                %
              </span>
            </div>
          </div>
        </div>

        {/* Row 2, Col 3: Discovery Leads */}
        <div className="py-2.5 px-3.5 rounded-2xl border border-purple-200/70 dark:border-purple-900/30 bg-[#FAF5FF] dark:bg-purple-950/20 flex flex-col justify-between shadow-xs transition-all min-h-[68px]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="w-2 h-2 rounded-full bg-[#AA00FF] shrink-0" />
              <span className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate">Discovery Leads</span>
            </div>
            {discoveryCount > 0 && (
              <span className="text-xs font-mono text-gray-400 dark:text-[#777788] shrink-0">({discoveryCount})</span>
            )}
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <span
              className="text-sm sm:text-base font-bold text-gray-900 dark:text-white font-sans tracking-tight truncate shrink-0"
              title={hasRevenueData ? formatCurrency(discoveryRevenue) : `${discoveryCount} Leads`}
            >
              {hasRevenueData ? formatCurrency(discoveryRevenue) : `${discoveryCount} Leads`}
            </span>
            <div className="flex items-center gap-2 flex-1 max-w-[130px]">
              <div className="w-full bg-gray-200/80 dark:bg-white/10 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-[#AA00FF] h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${
                      hasRevenueData
                        ? totalEstimatedRevenue > 0
                          ? (discoveryRevenue / totalEstimatedRevenue) * 100
                          : 0
                        : totalRowsCount > 0
                        ? (discoveryCount / totalRowsCount) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
              <span className="text-[10px] text-gray-400 dark:text-[#888899] font-mono shrink-0">
                {hasRevenueData
                  ? totalEstimatedRevenue > 0
                    ? ((discoveryRevenue / totalEstimatedRevenue) * 100).toFixed(1)
                    : 0
                  : totalRowsCount > 0
                  ? ((discoveryCount / totalRowsCount) * 100).toFixed(1)
                  : 0}
                %
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

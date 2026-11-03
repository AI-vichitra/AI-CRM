"use client";

import React, { useState } from "react";
import { Calendar, ChevronDown } from "lucide-react";

export type DatePreset = "today" | "this_week" | "this_month" | "last_month" | "this_year" | "all" | "custom";

export interface DateFilterValue {
  preset: DatePreset;
  startDate: string; // "YYYY-MM-DD", only used when preset === "custom"
  endDate: string; // "YYYY-MM-DD", only used when preset === "custom"
}

interface DateRangeFilterProps {
  value: DateFilterValue;
  onChange: (value: DateFilterValue) => void;
}

const PRESETS: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "this_year", label: "This Year" },
  { value: "all", label: "All Time" },
];

const formatDisplayDate = (iso: string) => {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
};

export default function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(value.preset === "custom");
  const [draftStart, setDraftStart] = useState(value.startDate);
  const [draftEnd, setDraftEnd] = useState(value.endDate);

  const applyPreset = (preset: DatePreset) => {
    setShowCustom(false);
    onChange({ preset, startDate: "", endDate: "" });
    setIsOpen(false);
  };

  const applyCustomRange = () => {
    if (!draftStart || !draftEnd) return;
    onChange({ preset: "custom", startDate: draftStart, endDate: draftEnd });
    setIsOpen(false);
  };

  const displayLabel =
    value.preset === "custom" && value.startDate && value.endDate
      ? `${formatDisplayDate(value.startDate)} - ${formatDisplayDate(value.endDate)}`
      : PRESETS.find(p => p.value === value.preset)?.label || "All Time";

  return (
    <div className="relative">
      <button
        onClick={() => {
          setDraftStart(value.startDate);
          setDraftEnd(value.endDate);
          setShowCustom(value.preset === "custom");
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-[#111118] hover:bg-gray-50 dark:hover:bg-[#1C1C2D] border border-gray-250 dark:border-[rgba(255,255,255,0.08)] text-gray-700 dark:text-white text-xs font-sans font-semibold rounded-lg transition-all cursor-pointer outline-none"
      >
        <Calendar className="w-3.5 h-3.5 text-gray-400 dark:text-[#888899]" />
        <span>{displayLabel}</span>
        <ChevronDown className={`w-3 h-3 text-gray-400 dark:text-[#888899] transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-1.5 w-64 bg-white dark:bg-[#161622] border border-gray-200 dark:border-[rgba(255,255,255,0.08)] rounded-xl shadow-2xl z-20 p-2">
            <div className="space-y-0.5">
              {PRESETS.map(p => (
                <button
                  key={p.value}
                  onClick={() => applyPreset(p.value)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-sans transition-colors cursor-pointer ${
                    value.preset === p.value
                      ? "text-blue-600 dark:text-blue-400 font-semibold bg-gray-50 dark:bg-[#1C1C2D]"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1C1C2D]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
              <button
                onClick={() => setShowCustom(true)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-sans transition-colors cursor-pointer ${
                  value.preset === "custom"
                    ? "text-blue-600 dark:text-blue-400 font-semibold bg-gray-50 dark:bg-[#1C1C2D]"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#1C1C2D]"
                }`}
              >
                Custom Date
              </button>
            </div>

            {showCustom && (
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-[rgba(255,255,255,0.06)] px-1 pb-1 space-y-2">
                <div className="flex items-center gap-1.5">
                  <input
                    type="date"
                    value={draftStart}
                    max={draftEnd || undefined}
                    onChange={(e) => setDraftStart(e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-[rgba(255,255,255,0.08)] bg-white dark:bg-[#111118] text-gray-700 dark:text-white text-[11px] font-sans outline-none"
                  />
                  <span className="text-[11px] text-gray-400 dark:text-[#888899] shrink-0">to</span>
                  <input
                    type="date"
                    value={draftEnd}
                    min={draftStart || undefined}
                    onChange={(e) => setDraftEnd(e.target.value)}
                    className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-gray-200 dark:border-[rgba(255,255,255,0.08)] bg-white dark:bg-[#111118] text-gray-700 dark:text-white text-[11px] font-sans outline-none"
                  />
                </div>
                <button
                  onClick={applyCustomRange}
                  disabled={!draftStart || !draftEnd}
                  className="w-full px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-200 dark:disabled:bg-white/5 disabled:text-gray-400 disabled:cursor-not-allowed text-white text-xs font-sans font-semibold transition-colors cursor-pointer"
                >
                  Apply
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

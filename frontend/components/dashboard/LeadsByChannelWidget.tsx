"use client";

import React from "react";
import { BarChart2 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

export interface LeadsByChannelPoint {
  name: string;
  Inbound: number;
  Outbound: number;
  PR: number;
  Government: number;
}

interface LeadsByChannelWidgetProps {
  data: LeadsByChannelPoint[];
  rangeMonths: string;
  onRangeMonthsChange: (key: string) => void;
}

// Colors match the Inbound/Outbound/PR/Government cards above, so identity carries
// across the dashboard.
const SERIES = [
  { key: "Inbound", color: "#10B981" },
  { key: "Outbound", color: "#3B82F6" },
  { key: "PR", color: "#D946EF" },
  { key: "Government", color: "#F97316" },
] as const;

const RANGE_OPTIONS = [
  { label: "This Month", value: "this_month" },
  { label: "Last Month", value: "last_month" },
  { label: "Last 3 Months", value: "3" },
  { label: "Last 6 Months", value: "6" },
  { label: "Last 12 Months", value: "12" },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-[#0C0C12] border border-[rgba(255,255,255,0.08)] rounded-lg p-2.5 shadow-2xl font-sans text-xs">
        <p className="text-[#888899] mb-1.5 font-mono">{label}</p>
        <div className="space-y-1 font-mono">
          {payload.map((item: any) => (
            <p key={item.dataKey} style={{ color: item.color }} className="font-semibold flex items-center gap-4">
              <span>{item.dataKey}:</span>
              <span>{Number(item.value).toLocaleString("en-IN")}</span>
            </p>
          ))}
        </div>
      </div>
    );
  }
  return null;
};

export default function LeadsByChannelWidget({ data, rangeMonths, onRangeMonthsChange }: LeadsByChannelWidgetProps) {
  const hasData = data.some(d => d.Inbound > 0 || d.Outbound > 0 || d.PR > 0 || d.Government > 0);

  return (
    <div className="rounded-2xl p-5 border border-gray-200 dark:border-[rgba(255,255,255,0.06)] bg-white dark:bg-[#111118] flex flex-col shadow-sm dark:shadow-xl h-full">
      <div className="mb-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-violet-500" />
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white tracking-wide">Lead</h4>
          </div>
          <select
            value={rangeMonths}
            onChange={(e) => onRangeMonthsChange(e.target.value)}
            className="ml-auto px-2.5 py-1 rounded-lg border border-gray-200 dark:border-[rgba(255,255,255,0.08)] text-[10px] font-sans font-semibold text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-[#161622] hover:bg-gray-100 dark:hover:bg-[#1C1C2D] transition-colors cursor-pointer outline-none whitespace-nowrap"
          >
            {RANGE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3 text-[10px] font-mono flex-wrap mt-2">
          {SERIES.map(s => (
            <div key={s.key} className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-gray-500 dark:text-[#888899]">{s.key}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="w-full min-w-0 relative flex-1" style={{ minHeight: "220px" }}>
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barGap={3}>
              <CartesianGrid stroke="currentColor" strokeOpacity={0.06} vertical={false} />
              <XAxis dataKey="name" stroke="currentColor" strokeOpacity={0.1} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#888899" }} />
              <YAxis stroke="currentColor" strokeOpacity={0.1} tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#888899" }} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: "currentColor", fillOpacity: 0.04 }} />
              {SERIES.map(s => (
                <Bar key={s.key} dataKey={s.key} fill={s.color} radius={[3, 3, 0, 0]} maxBarSize={16} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-xs text-gray-400 dark:text-[#555566] font-mono">
            No data available
          </div>
        )}
      </div>
    </div>
  );
}

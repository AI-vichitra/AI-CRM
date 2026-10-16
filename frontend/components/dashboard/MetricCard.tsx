import React from "react";
import { MoreVertical } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string;
  delta?: string | null;
  index?: number;
  isSelected?: boolean;
  onClick?: () => void;
}

export default function MetricCard({
  label,
  value,
  delta,
  index = 0,
  isSelected,
  onClick,
}: MetricCardProps) {
  const [displayValue, setDisplayValue] = React.useState("0");

  React.useEffect(() => {
    // Basic animation for numeric values
    const numericPart = value.replace(/[^0-9]/g, "");
    if (!numericPart) {
      setDisplayValue(value);
      return;
    }

    const target = parseFloat(numericPart);
    const prefix = value.match(/^[^0-9]*/)?.[0] || "";
    const suffix = value.match(/[0-9]*([^0-9]*)$/)?.[1] || "";

    let start = 0;
    const duration = 800; // ms
    const startTime = performance.now();

    function animate(time: number) {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeProgress = progress * (2 - progress);
      const current = Math.floor(start + easeProgress * (target - start));
      
      let formatted = current.toLocaleString("en-IN");
      if ((prefix === "$" || prefix === "₹") && current >= 1000) {
        formatted = current.toLocaleString("en-IN");
      }
      
      setDisplayValue(`${prefix}${formatted}${suffix}`);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    }

    requestAnimationFrame(animate);
  }, [value]);

  const isAccent = isSelected !== undefined ? isSelected : index === 0;

  return (
    <div 
      onClick={onClick}
      title={onClick ? (isSelected ? "Click to clear filter and show all leads" : `Click to filter table by ${label}`) : undefined}
      className={`relative overflow-hidden transition-all duration-150 group p-5 flex flex-col justify-between rounded-2xl border bg-white dark:bg-[#111118] text-gray-900 dark:text-white shadow-sm dark:shadow-xl ${
        onClick ? "cursor-pointer hover:border-gray-300 dark:hover:border-white/20 select-none" : ""
      } ${
        isAccent 
          ? "border-emerald-500/40 border-t-2 border-t-emerald-500 dark:border-t-emerald-400 ring-1 ring-emerald-500/20" 
          : "border-gray-200 dark:border-[rgba(255,255,255,0.06)]"
      }`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Subtle background glow for the accent card */}
      {isAccent && (
        <div className="absolute -right-6 -bottom-6 w-16 h-16 rounded-full bg-emerald-500/10 blur-xl pointer-events-none" />
      )}

      {/* Top Row: Label and Three Dots */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[11px] font-sans font-medium tracking-wide text-gray-500 dark:text-[#888899]">
            {label}
          </span>
          {isSelected && (
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold uppercase bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
              Filtered
            </span>
          )}
        </div>
        <button 
          type="button" 
          onClick={(e) => { e.stopPropagation(); }}
          className="p-0.5 rounded transition-colors cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 text-[#888899] hover:text-gray-900 dark:hover:text-white"
        >
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Middle Row: Large Value */}
      <div className="mt-1">
        <h3 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {displayValue}
        </h3>
      </div>

      {/* Bottom Row: Delta Pill Badge */}
      <div className="mt-1.5 flex justify-start">
        {delta && (
          <span 
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-[#3CD395] border border-emerald-500/20"
          >
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

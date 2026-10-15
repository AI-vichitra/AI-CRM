"use client";

import React, { useState, useEffect } from "react";
import { X, Save } from "lucide-react";

interface LeadFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  headers: string[];
  initialData?: Record<string, any> | null;
  onSave: (data: Record<string, any>) => Promise<void>;
  title: string;
  currentTab?: string;
  mandatoryColumns?: string[];
}

// Helper to parse dates like DD/MM/YYYY or DD-MM-YYYY
const parseDate = (dateVal: any): Date | null => {
  if (!dateVal) return null;
  const dateStr = String(dateVal).trim();
  if (!dateStr || dateStr === "—" || dateStr.toLowerCase() === "placeholder") return null;

  const parts = dateStr.split(/[-/.]/);
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

// Helper to format date cleanly as YYYY-MM-DD for date inputs
const formatDateForInput = (dateVal: any): string => {
  if (!dateVal) return "";
  const parsed = parseDate(dateVal);
  if (!parsed) return String(dateVal).trim();
  const yyyy = parsed.getFullYear();
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const getTodayInputDate = (): string => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const SOURCE_OPTIONS = [
  "Referral",
  "LinkedIn",
  "Website",
  "Inbound",
  "Internal",
  "Direct",
  "Direct mail",
  "Outbound",
  "Tender",
];

const REQUIREMENT_OPTIONS = [
  "SOCIAL MEDIA",
  "PERORMANCE MRKT",
  "WEBSITE",
  "SEO/GEO/AEO",
  "BRANDING",
  "PR",
  "VIDEO SHOOTS",
];

export default function LeadFormModal({
  isOpen,
  onClose,
  headers,
  initialData,
  onSave,
  title,
  currentTab,
  mandatoryColumns = [],
}: LeadFormModalProps) {
  const [loading, setLoading] = useState(false);

  // Toggle state: Retainer vs Project
  const [leadType, setLeadType] = useState<"Retainer" | "Project">("Retainer");

  // Form states
  const [date, setDate] = useState("");
  const [company, setCompany] = useState("");
  const [pocName, setPocName] = useState("");
  const [pocEmail, setPocEmail] = useState("");
  const [pocPhone, setPocPhone] = useState("");
  const [cogPoc, setCogPoc] = useState("");
  const [source, setSource] = useState("");
  const [requirement, setRequirement] = useState("");
  const [customRequirement, setCustomRequirement] = useState("");
  const [costValue, setCostValue] = useState("");

  // Generic fallback state for internal leads tab
  const [genericFormData, setGenericFormData] = useState<Record<string, string>>({});

  const isActiveLeadsMode = currentTab !== "internal_leads";

  // Generic form headers for internal leads fallback
  let genericHeaders = headers.filter(
    (h) => h !== "_row_num" && h.toLowerCase() !== "no."
  );
  if (currentTab === "internal_leads" && !genericHeaders.some((h) => h.toLowerCase() === "lead type")) {
    genericHeaders.push("Lead Type");
  }

  useEffect(() => {
    if (!isOpen) return;

    if (initialData && Object.keys(initialData).length > 0) {
      // Determine if lead is Retainer or Project
      const isRetainer =
        Boolean(initialData["Retainer Cost"] && String(initialData["Retainer Cost"]).trim()) ||
        Boolean(initialData["Retainer cost"] && String(initialData["Retainer cost"]).trim()) ||
        String(initialData["Type of Project"] || "").toLowerCase().includes("retainer");

      const category = isRetainer ? "Retainer" : "Project";
      setLeadType(category);

      const rawDate = initialData["Date"] || initialData["date"] || "";
      setDate(formatDateForInput(rawDate) || getTodayInputDate());

      setCompany(
        String(
          initialData["Company/Brand Name"] ||
            initialData["Company"] ||
            initialData["Company Name"] ||
            initialData["company"] ||
            ""
        ).trim()
      );

      setPocName(
        String(
          initialData["Company POC Name"] ||
            initialData["Name"] ||
            initialData["POC Name"] ||
            initialData["poc_name"] ||
            ""
        ).trim()
      );

      setPocEmail(
        String(
          initialData["Company POC Email ID"] ||
            initialData["Email"] ||
            initialData["Email Id"] ||
            initialData["email"] ||
            ""
        ).trim()
      );

      setPocPhone(
        String(
          initialData["Company POC Phone Number"] ||
            initialData["Phone"] ||
            initialData["Contact No."] ||
            initialData["phone"] ||
            ""
        ).trim()
      );

      setCogPoc(
        String(
          initialData["Cog POC Name"] ||
            initialData["Cog POC"] ||
            initialData["cog_poc"] ||
            ""
        ).trim()
      );

      setSource(String(initialData["Source"] || initialData["source"] || "").trim());

      // Requirement handling
      const rawReq = String(initialData["Requirement"] || initialData["requirement"] || "").trim();
      if (rawReq) {
        const matched = REQUIREMENT_OPTIONS.find(
          (opt) => opt.toLowerCase() === rawReq.toLowerCase()
        );
        if (matched) {
          setRequirement(matched);
          setCustomRequirement("");
        } else {
          setRequirement("OTHER");
          setCustomRequirement(rawReq);
        }
      } else {
        setRequirement("");
        setCustomRequirement("");
      }

      // Cost handling depending on Retainer vs Project
      if (isRetainer) {
        setCostValue(
          String(initialData["Retainer Cost"] || initialData["Retainer cost"] || "").trim()
        );
      } else {
        setCostValue(
          String(
            initialData["Revenue Estimations"] ||
              initialData["Revenue Estimation (In INR) (Oct 26 - Mar 27)"] ||
              initialData["Revenue"] ||
              ""
          ).trim()
        );
      }

      // Generic fallback
      const parsedGeneric: Record<string, string> = {};
      genericHeaders.forEach((h) => {
        const hl = h.toLowerCase();
        const rawVal = initialData[h];
        if (hl.includes("date") || hl.includes("deadline") || hl.includes("due")) {
          parsedGeneric[h] = formatDateForInput(rawVal);
        } else {
          parsedGeneric[h] = String(rawVal || "");
        }
      });
      setGenericFormData(parsedGeneric);
    } else {
      // New lead defaults
      setLeadType("Retainer");
      setDate(getTodayInputDate());
      setCompany("");
      setPocName("");
      setPocEmail("");
      setPocPhone("");
      setCogPoc("");
      setSource("");
      setRequirement("");
      setCustomRequirement("");
      setCostValue("");

      const emptyGeneric: Record<string, string> = {};
      genericHeaders.forEach((h) => {
        emptyGeneric[h] = "";
      });
      setGenericFormData(emptyGeneric);
    }
  }, [initialData, isOpen, headers, currentTab]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!isActiveLeadsMode) {
        await onSave(genericFormData);
        onClose();
        return;
      }

      // Build payload for Active Leads mapped precisely to sheet headers
      const payload: Record<string, any> = {
        ...(initialData || {}),
      };

      // 1. Date
      payload["Date"] = date;

      // 2. Company / Brand Name -> map to Company and Company/Brand Name
      payload["Company"] = company;
      headers.forEach((h) => {
        const hl = h.toLowerCase().trim();
        if (hl === "company" || hl === "company name" || hl === "company/brand name") {
          payload[h] = company;
        }
      });

      // 3. Company POC Name -> map to Name & POC Name
      payload["Name"] = pocName;
      headers.forEach((h) => {
        const hl = h.toLowerCase().trim();
        if (hl === "name" || hl === "poc name" || hl === "company poc name") {
          payload[h] = pocName;
        }
      });

      // 4. Company POC Email ID -> map to Email & Email Id (Optional)
      payload["Email"] = pocEmail;
      headers.forEach((h) => {
        const hl = h.toLowerCase().trim();
        if (hl === "email" || hl === "email id" || hl === "company poc email id") {
          payload[h] = pocEmail;
        }
      });

      // 5. Company POC Phone Number -> map to Phone & Contact No. (Optional)
      payload["Phone"] = pocPhone;
      headers.forEach((h) => {
        const hl = h.toLowerCase().trim();
        if (hl === "phone" || hl === "contact no." || hl === "company poc phone number") {
          payload[h] = pocPhone;
        }
      });

      // 6. Cog POC Name -> map to Cog POC & Cog POC Name
      payload["Cog POC"] = cogPoc;
      headers.forEach((h) => {
        const hl = h.toLowerCase().trim();
        if (hl === "cog poc" || hl === "cog poc name") {
          payload[h] = cogPoc;
        }
      });

      // 7. Source
      payload["Source"] = source;
      headers.forEach((h) => {
        const hl = h.toLowerCase().trim();
        if (hl === "source" || hl === "lead source") {
          payload[h] = source;
        }
      });

      // 8. Requirement
      const finalReq = (requirement === "OTHER" ? customRequirement : requirement) || "";
      payload["Requirement"] = finalReq;

      // 9. Cost field based on Toggle: Retainer vs Project
      if (leadType === "Retainer") {
        payload["Retainer cost"] = costValue;
        payload["Retainer Cost"] = costValue;
        payload["Revenue Estimations"] = "";
        payload["Revenue Estimation (In INR) (Oct 26 - Mar 27)"] = "";
        payload["Type of Project"] = "Retainer";
      } else {
        payload["Revenue Estimations"] = costValue;
        payload["Revenue Estimation (In INR) (Oct 26 - Mar 27)"] = costValue;
        payload["Retainer cost"] = "";
        payload["Retainer Cost"] = "";
        payload["Type of Project"] = "Project";
      }

      await onSave(payload);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      {/* Click outside backdrop to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0C0C12] border border-gray-200 dark:border-[rgba(255,255,255,0.08)] shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[90vh] z-10 animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-[rgba(255,255,255,0.05)] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white font-sans tracking-wide">
              {initialData?.Company || initialData?.["Company Name"] ? `Update Lead (${initialData?.Company || initialData?.["Company Name"]})` : title}
            </h3>
            <span className="px-2 py-0.5 text-[10px] font-medium bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/20 rounded-full">
              Active Leads
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 dark:text-[#555566] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Active Leads form */}
        {isActiveLeadsMode ? (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
            {/* Top Toggle: Retainer vs Project (Fixed Type of Project) */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899]">
                Lead Type (Type of Project)
              </label>
              <div className="grid grid-cols-2 p-1 bg-gray-100 dark:bg-[#161622] rounded-xl border border-gray-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setLeadType("Retainer")}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    leadType === "Retainer"
                      ? "bg-white dark:bg-emerald-600 text-gray-900 dark:text-white shadow-sm font-bold"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <span>🏢 Retainer</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLeadType("Project")}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    leadType === "Project"
                      ? "bg-white dark:bg-emerald-600 text-gray-900 dark:text-white shadow-sm font-bold"
                      : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  }`}
                >
                  <span>🚀 Project</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* 1. Date (Compulsory) */}
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899] flex items-center gap-1">
                  <span>Date</span>
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={date}
                  required
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] focus:border-emerald-500 rounded-lg text-gray-900 dark:text-white font-sans outline-none transition-all"
                />
              </div>

              {/* 2. Company/Brand Name (Compulsory) */}
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899] flex items-center gap-1">
                  <span>Company/Brand Name</span>
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter Company or Brand Name..."
                  value={company}
                  required
                  onChange={(e) => setCompany(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] focus:border-emerald-500 rounded-lg text-gray-900 dark:text-white font-sans outline-none transition-all"
                />
              </div>

              {/* 3. Company POC Name (Compulsory) */}
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899] flex items-center gap-1">
                  <span>Company POC Name</span>
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter Company POC Name..."
                  value={pocName}
                  required
                  onChange={(e) => setPocName(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] focus:border-emerald-500 rounded-lg text-gray-900 dark:text-white font-sans outline-none transition-all"
                />
              </div>

              {/* 4. Cog POC Name (Compulsory) */}
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899] flex items-center gap-1">
                  <span>Cog POC Name</span>
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter Cog POC Name..."
                  value={cogPoc}
                  required
                  onChange={(e) => setCogPoc(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] focus:border-emerald-500 rounded-lg text-gray-900 dark:text-white font-sans outline-none transition-all"
                />
              </div>

              {/* 5. Company POC Email ID (Optional) */}
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899] flex items-center gap-1.5">
                  <span>Company POC Email ID</span>
                  <span className="text-[9px] text-gray-400 font-sans lowercase">(optional)</span>
                </label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  value={pocEmail}
                  onChange={(e) => setPocEmail(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] focus:border-emerald-500 rounded-lg text-gray-900 dark:text-white font-sans outline-none transition-all"
                />
              </div>

              {/* 6. Company POC Phone Number (Optional) */}
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899] flex items-center gap-1.5">
                  <span>Company POC Phone Number</span>
                  <span className="text-[9px] text-gray-400 font-sans lowercase">(optional)</span>
                </label>
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={pocPhone}
                  onChange={(e) => setPocPhone(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] focus:border-emerald-500 rounded-lg text-gray-900 dark:text-white font-sans outline-none transition-all"
                />
              </div>

              {/* 7. Source (Compulsory) */}
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899] flex items-center gap-1">
                  <span>Source</span>
                  <span className="text-red-500">*</span>
                </label>
                <select
                  value={source}
                  required
                  onChange={(e) => setSource(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] focus:border-emerald-500 rounded-lg text-gray-900 dark:text-white font-sans outline-none cursor-pointer"
                >
                  <option value="">-- Select Source --</option>
                  {SOURCE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                  {source && !SOURCE_OPTIONS.includes(source) && (
                    <option value={source}>{source}</option>
                  )}
                </select>
              </div>

              {/* 8. Requirement (Compulsory) */}
              <div className="space-y-1.5 flex flex-col">
                <label className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899] flex items-center gap-1">
                  <span>Requirement</span>
                  <span className="text-red-500">*</span>
                </label>
                <select
                  value={requirement}
                  required
                  onChange={(e) => setRequirement(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] focus:border-emerald-500 rounded-lg text-gray-900 dark:text-white font-sans outline-none cursor-pointer"
                >
                  <option value="">-- Select Requirement --</option>
                  {REQUIREMENT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                  <option value="OTHER">Other / Custom</option>
                </select>
                {requirement === "OTHER" && (
                  <input
                    type="text"
                    required
                    placeholder="Enter custom requirement..."
                    value={customRequirement}
                    onChange={(e) => setCustomRequirement(e.target.value)}
                    className="w-full mt-1.5 px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] focus:border-emerald-500 rounded-lg text-gray-900 dark:text-white font-sans outline-none transition-all"
                  />
                )}
              </div>

              {/* 9. Dynamic Financial Field: Retainer Cost vs Revenue Estimations (Compulsory, full width) */}
              <div className="space-y-1.5 flex flex-col md:col-span-2">
                <label className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899] flex items-center justify-between">
                  <span className="flex items-center gap-1">
                    <span>{leadType === "Retainer" ? "Retainer Cost" : "Revenue Estimations"}</span>
                    <span className="text-red-500">*</span>
                  </span>
                  {leadType === "Retainer" && (
                    <span className="px-1.5 py-0.5 text-[9px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 rounded border border-indigo-200 dark:border-indigo-800 uppercase tracking-wide">
                      Monthly
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    leadType === "Retainer"
                      ? "Enter Retainer Cost (e.g. 1,50,000)..."
                      : "Enter Revenue Estimations (e.g. 5,00,000)..."
                  }
                  value={costValue}
                  onChange={(e) => setCostValue(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] focus:border-emerald-500 rounded-lg text-gray-900 dark:text-white font-sans outline-none transition-all"
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="pt-5 border-t border-gray-100 dark:border-[rgba(255,255,255,0.05)] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-200 dark:border-[rgba(255,255,255,0.06)] hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-[#dedee5] text-xs font-semibold rounded-lg transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-[#1D9E75] hover:bg-[#198763] disabled:bg-[#1D9E75]/50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_12px_rgba(29,158,117,0.15)]"
              >
                {loading ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                {initialData?._row_num ? "Save Changes" : "Add Lead"}
              </button>
            </div>
          </form>
        ) : (
          /* Generic fallback form for internal leads */
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit(e);
            }}
            className="flex-1 overflow-y-auto p-6 space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {genericHeaders.map((header) => {
                const hl = header.toLowerCase();
                const val = genericFormData[header] || "";
                return (
                  <div key={header} className="space-y-1.5 flex flex-col">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-gray-500 dark:text-[#888899]">
                      {header}
                    </label>
                    <input
                      type={hl.includes("date") || hl.includes("deadline") || hl.includes("due") ? "date" : "text"}
                      placeholder={`Enter ${header}...`}
                      value={val}
                      onChange={(e) =>
                        setGenericFormData((prev) => ({ ...prev, [header]: e.target.value }))
                      }
                      className="w-full px-3.5 py-2 text-xs bg-gray-50 dark:bg-[#161622] border border-gray-200 dark:border-[rgba(255,255,255,0.06)] focus:border-emerald-500 rounded-lg text-gray-900 dark:text-white font-sans outline-none"
                    />
                  </div>
                );
              })}
            </div>
            <div className="pt-5 border-t border-gray-100 dark:border-[rgba(255,255,255,0.05)] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-200 dark:border-[rgba(255,255,255,0.06)] hover:bg-gray-50 dark:hover:bg-white/5 text-gray-700 dark:text-[#dedee5] text-xs font-semibold rounded-lg transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-[#1D9E75] hover:bg-[#198763] disabled:bg-[#1D9E75]/50 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-all cursor-pointer shadow-[0_0_12px_rgba(29,158,117,0.15)]"
              >
                {loading ? (
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                Save Changes
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

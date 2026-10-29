"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Plus,
  Clock,
  Phone,
  MessageCircle,
  Mail,
  Calendar as CalendarIcon,
  Send,
  ChevronLeft,
  ChevronRight,
  Trash2,
  CalendarCheck,
  Building,
  User,
  Info,
  Edit3,
  Save,
  Check,
  Tag,
  DollarSign,
  Layers,
  FileText,
  ExternalLink,
} from "lucide-react";
import { api } from "../../lib/api";
import { Conversation } from "../../lib/types";
import { toast } from "sonner";

interface ActionConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Record<string, any> | null;
  onSaveLead?: (updatedData: Record<string, any>) => Promise<void>;
  currentUser?: { name?: string; email?: string } | null;
}

const CONVERSATION_TYPES = [
  { id: "Call", label: "Call", icon: Phone },
  { id: "WhatsApp", label: "WhatsApp", icon: MessageCircle },
  { id: "Email", label: "Email", icon: Mail },
  { id: "Meeting", label: "Meeting", icon: CalendarIcon },
] as const;

type ConversationTypeId = (typeof CONVERSATION_TYPES)[number]["id"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

const STAGE_OPTIONS = [
  "Lead",
  "Contacted",
  "Proposal sent",
  "Proposal to be Sent",
  "Negotiation",
  "Won",
  "Lost",
];

const STATUS_OPTIONS = ["Hot", "Warm", "Cold"];

// Helper to format Date object into YYYY-MM-DD
const formatDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Helper to parse and format any date string cleanly as YYYY-MM-DD for HTML date inputs
const formatDateForInput = (val: any): string => {
  if (!val) return "";
  const str = String(val).trim();
  if (!str || str === "—" || str.toLowerCase() === "placeholder") return "";

  // Handle Excel/Sheets serial numbers (e.g. 46216)
  const numVal = Number(str);
  if (!isNaN(numVal) && numVal >= 30000 && numVal <= 65000) {
    const utcDate = new Date((numVal - 25569) * 86400 * 1000);
    const y = utcDate.getUTCFullYear();
    const m = String(utcDate.getUTCMonth() + 1).padStart(2, "0");
    const d = String(utcDate.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const parts = str.split(/[T\s]/)[0].split(/[-/.]/);
  if (parts.length === 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);
    if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
      if (parts[0].length === 4) {
        return `${p0}-${String(p1).padStart(2, "0")}-${String(p2).padStart(2, "0")}`;
      }
      if (parts[2].length === 4) {
        if (p0 <= 12 && p1 > 12) {
          return `${p2}-${String(p0).padStart(2, "0")}-${String(p1).padStart(2, "0")}`;
        }
        return `${p2}-${String(p1).padStart(2, "0")}-${String(p0).padStart(2, "0")}`;
      }
      if (parts[2].length === 2) {
        const fullYear = p2 < 50 ? 2000 + p2 : 1900 + p2;
        if (p0 <= 12 && p1 > 12) {
          return `${fullYear}-${String(p0).padStart(2, "0")}-${String(p1).padStart(2, "0")}`;
        }
        return `${fullYear}-${String(p1).padStart(2, "0")}-${String(p0).padStart(2, "0")}`;
      }
    }
  }
  const parsed = Date.parse(str);
  if (!isNaN(parsed)) {
    const d = new Date(parsed);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return str;
};

// Helper to parse string dates into Date
const parseDateSafe = (val: any): Date => {
  if (!val) return new Date();
  const str = String(val).trim();

  // Handle Excel/Sheets serial numbers (e.g. 46216)
  const numVal = Number(str);
  if (!isNaN(numVal) && numVal >= 30000 && numVal <= 65000) {
    const utcDate = new Date((numVal - 25569) * 86400 * 1000);
    return new Date(utcDate.getUTCFullYear(), utcDate.getUTCMonth(), utcDate.getUTCDate());
  }

  const parts = str.split(/[-/.]/);
  if (parts.length === 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);
    if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
      if (parts[0].length === 4) return new Date(p0, p1 - 1, p2);
      if (parts[2].length === 4) return new Date(p2, p1 - 1, p0);
      if (parts[2].length === 2) {
        const fullYear = p2 < 50 ? 2000 + p2 : 1900 + p2;
        return new Date(fullYear, p1 - 1, p0);
      }
    }
  }
  const parsed = Date.parse(str);
  return isNaN(parsed) ? new Date() : new Date(parsed);
};

// Helper to format date cleanly as DD-MM-YY
const formatDisplayDate = (val: any): string => {
  if (!val) return "—";
  const str = String(val).trim();
  if (!str || str === "—" || str.toLowerCase() === "placeholder") return "—";
  const parsed = parseDateSafe(str);
  if (!parsed || isNaN(parsed.getTime())) return str;
  const yy = String(parsed.getFullYear()).slice(-2);
  const mm = String(parsed.getMonth() + 1).padStart(2, "0");
  const dd = String(parsed.getDate()).padStart(2, "0");
  return `${dd}-${mm}-${yy}`;
};

export default function ActionConversationModal({
  isOpen,
  onClose,
  lead,
  onSaveLead,
  currentUser,
}: ActionConversationModalProps) {
  // Navigation & view modes
  const [activeTab, setActiveTab] = useState<"new" | "history" | "edit">("new");
  const [selectedType, setSelectedType] = useState<ConversationTypeId>("Call");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  // Calendar state: month index (0-11) and full year
  const [currentYear, setCurrentYear] = useState<number>(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(() => formatDateStr(new Date()));

  // Lead Edit Form States
  const [savingLead, setSavingLead] = useState(false);
  const [editCompany, setEditCompany] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editCogPoc, setEditCogPoc] = useState("");
  const [editCogPocEmail, setEditCogPocEmail] = useState("");
  const [editSource, setEditSource] = useState("");
  const [editPocName, setEditPocName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRequirements, setEditRequirements] = useState<string[]>([]);
  const [otherReqInput, setOtherReqInput] = useState("");
  const [editProjectType, setEditProjectType] = useState("Retainer");
  const [editRetainerCost, setEditRetainerCost] = useState("");
  const [editRevenueEst, setEditRevenueEst] = useState("");
  const [editStage, setEditStage] = useState("Lead");
  const [editStatus, setEditStatus] = useState("Hot");
  const [editFollowUpDate, setEditFollowUpDate] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editRemarks, setEditRemarks] = useState("");
  const [editMessageFromProspect, setEditMessageFromProspect] = useState("");
  const [editIntroCall, setEditIntroCall] = useState("");
  const [editFollowUp1, setEditFollowUp1] = useState("");
  const [editFollowUp2, setEditFollowUp2] = useState("");
  const [editLinkedinAdLink, setEditLinkedinAdLink] = useState("");

  // Resolve lead identifier
  const leadId = useMemo(() => {
    if (!lead) return "";
    if (lead._row_num) return `lead_row_${lead._row_num}`;
    return String(lead["Company"] || lead["Company Name"] || "lead").trim();
  }, [lead]);

  const companyName = useMemo(() => {
    if (!lead) return "Lead";
    return lead["Company"] || lead["Company Name"] || lead["Campaign"] || "Lead";
  }, [lead]);

  // Initialize or reset state when modal opens
  useEffect(() => {
    if (isOpen && lead) {
      // Determine initial calendar month and selected date based on lead date or today
      const leadDateRaw = lead["Date"] || lead["date"];
      const initialDateObj = leadDateRaw ? parseDateSafe(leadDateRaw) : new Date();
      setCurrentYear(initialDateObj.getFullYear());
      setCurrentMonth(initialDateObj.getMonth());
      setSelectedDate(formatDateStr(initialDateObj));
      setMessage("");
      setActiveTab("new");
      loadConversations();

      // Populate lead edit fields
      setEditCompany(lead["Company"] || lead["Company Name"] || "");
      setEditDate(formatDateForInput(lead["Date"] || lead["date"] || formatDateStr(new Date())));
      setEditCogPoc(lead["Cog POC"] || lead["Cog POC Name"] || currentUser?.name || "");
      setEditCogPocEmail(lead["POC email"] || lead["Cog POC Email"] || currentUser?.email || "");
      setEditSource(lead["Lead Source"] || lead["Source"] || lead["Sources"] || "");
      setEditPocName(lead["POC Name"] || lead["Name"] || "");
      setEditPhone(lead["Contact No."] || lead["Phone"] || "");
      setEditEmail(lead["Email Id"] || lead["Email"] || "");

      // Requirements
      const rawReq = String(lead["Requirement"] || lead["requirements"] || "");
      if (rawReq) {
        const parsed = rawReq.split(/[,;/]+/).map((s) => s.trim()).filter(Boolean);
        setEditRequirements(parsed);
      } else {
        setEditRequirements([]);
      }
      setOtherReqInput("");

      // Commercials
      const projType = lead["Type of Project"] || (lead["Retainer Cost"] ? "Retainer" : "Project");
      setEditProjectType(projType);
      
      const rawRetainer = String(lead["Retainer Cost"] || lead["Retainer cost"] || "").replace(/^[₹$,\s]+/, "");
      setEditRetainerCost(rawRetainer);

      const rawRev = String(
        lead["Revenue Estimation (In INR) (Oct 26 - Mar 27)"] ||
        lead["Revenue Estimations"] ||
        lead["Revenue Estimation"] ||
        ""
      ).replace(/^[₹$,\s]+/, "");
      setEditRevenueEst(rawRev);

      // Advanced Pipeline
      setEditStage(lead["Stage"] || lead["Lead Status"] || "Lead");
      setEditStatus(lead["Status"] || lead["Lead"] || "Hot");
      setEditFollowUpDate(formatDateForInput(lead["Follow up date"] || lead["Follow-up Date"] || lead["follow up date"] || ""));
      setEditDeadline(formatDateForInput(lead["Deadline"] || lead["deadline"] || lead["Due Date"] || lead["Due"] || ""));
      setEditRemarks(lead["Remarks /Updates"] || lead["Last Update"] || "");
      setEditMessageFromProspect(lead["Message from Prospect"] || "");
      setEditIntroCall(lead["Intro Call"] || "");
      setEditFollowUp1(lead["Follow-up 1"] || "");
      setEditFollowUp2(lead["Follow-up 2"] || "");
      setEditLinkedinAdLink(lead["Linkedin Ad Link"] || lead["Lead Source Link"] || "");
    }
  }, [isOpen, lead, currentUser]);

  const loadConversations = async () => {
    if (!leadId) return;
    try {
      setLoading(true);
      const data = await api.getConversations(leadId, undefined, String(companyName).trim());
      setConversations(data || []);
    } catch (err: any) {
      console.error("Failed to load conversations:", err);
      toast.error(err.message || "Failed to load conversation history");
    } finally {
      setLoading(false);
    }
  };

  // Month navigation handlers
  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Build calendar matrix (leading, current, trailing days)
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1);
    const startDayOfWeek = firstDay.getDay(); // 0 for Sunday
    const totalDaysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const totalDaysInPrevMonth = new Date(currentYear, currentMonth, 0).getDate();

    const days: {
      dayNum: number;
      dateStr: string;
      isCurrentMonth: boolean;
    }[] = [];

    // Leading days from previous month
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = totalDaysInPrevMonth - i;
      const prevDate = new Date(currentYear, currentMonth - 1, d);
      days.push({
        dayNum: d,
        dateStr: formatDateStr(prevDate),
        isCurrentMonth: false,
      });
    }

    // Days in current month
    for (let d = 1; d <= totalDaysInCurrentMonth; d++) {
      const curDate = new Date(currentYear, currentMonth, d);
      days.push({
        dayNum: d,
        dateStr: formatDateStr(curDate),
        isCurrentMonth: true,
      });
    }

    // Trailing days from next month to complete rows of 7
    const totalCellsNeeded = Math.ceil(days.length / 7) * 7;
    const trailingCount = totalCellsNeeded - days.length;
    for (let d = 1; d <= trailingCount; d++) {
      const nextDate = new Date(currentYear, currentMonth + 1, d);
      days.push({
        dayNum: d,
        dateStr: formatDateStr(nextDate),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentYear, currentMonth]);

  // Set of dates that have recorded conversations
  const recordedDatesSet = useMemo(() => {
    const set = new Set<string>();
    conversations.forEach((c) => {
      if (c.date) set.add(c.date.trim());
    });
    return set;
  }, [conversations]);

  // Conversations on the currently selected date
  const selectedDateConversations = useMemo(() => {
    return conversations.filter((c) => c.date === selectedDate);
  }, [conversations, selectedDate]);

  // Save new conversation
  const handleSaveConversation = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!message.trim()) {
      toast.error("Please enter a message before saving.");
      return;
    }
    if (!leadId) {
      toast.error("Missing lead identifier.");
      return;
    }

    try {
      setSaving(true);
      const authorName =
        currentUser?.name ||
        String(lead?.["Cog POC"] || lead?.["Cog POC Name"] || "Cog Team").trim();

      const newEntry = await api.addConversation({
        lead_id: leadId,
        date: selectedDate,
        conversation_type: selectedType,
        message: message.trim(),
        lead_key: String(companyName).trim(),
        author: authorName,
      });

      setConversations((prev) => [newEntry, ...prev]);
      setMessage("");
      toast.success(`Conversation recorded for ${selectedDate}!`);
    } catch (err: any) {
      console.error("Save conversation error:", err);
      toast.error(err.message || "Failed to save conversation.");
    } finally {
      setSaving(false);
    }
  };

  // Delete conversation
  const handleDeleteConversation = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this conversation entry?")) return;
    try {
      await api.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      toast.success("Conversation deleted.");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete conversation.");
    }
  };

  // Toggle requirement item
  const toggleRequirement = (req: string) => {
    setEditRequirements((prev) =>
      prev.includes(req) ? prev.filter((r) => r !== req) : [...prev, req]
    );
  };

  const handleAddOtherRequirement = () => {
    if (!otherReqInput.trim()) return;
    const val = otherReqInput.trim();
    if (!editRequirements.includes(val)) {
      setEditRequirements((prev) => [...prev, val]);
    }
    setOtherReqInput("");
  };

  // Save Lead Details
  const handleSaveLeadDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lead) return;
    if (!onSaveLead) {
      toast.error("Lead saving handler not provided.");
      return;
    }

    try {
      setSavingLead(true);
      const updatedPayload: Record<string, any> = {
        ...lead,
        "Company": editCompany,
        "Company Name": editCompany,
        "Date": editDate,
        "Cog POC": editCogPoc,
        "POC email": editCogPocEmail,
        "Lead Source": editSource,
        "Source": editSource,
        "Requirement": editRequirements.join(", "),
        "POC Name": editPocName,
        "Contact No.": editPhone,
        "Email Id": editEmail,
        "Type of Project": editProjectType,
        "Retainer Cost": editRetainerCost,
        "Revenue Estimation (In INR) (Oct 26 - Mar 27)": editRevenueEst,
        "Revenue Estimation": editRevenueEst,
        "Stage": editStage,
        "Status": editStatus,
        "Follow up date": editFollowUpDate,
        "Deadline": editDeadline,
        "Due Date": editDeadline,
        "Remarks /Updates": editRemarks,
        "Message from Prospect": editMessageFromProspect,
        "Intro Call": editIntroCall,
        "Follow-up 1": editFollowUp1,
        "Follow-up 2": editFollowUp2,
        "Linkedin Ad Link": editLinkedinAdLink,
      };

      await onSaveLead(updatedPayload);
      setActiveTab("new");
    } catch (err: any) {
      console.error("Failed to update lead details:", err);
      toast.error(err.message || "Failed to update lead details.");
    } finally {
      setSavingLead(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-fade-in">
      {/* Click outside backdrop to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-3xl bg-white dark:bg-[#111118] border border-gray-200 dark:border-white/10 shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[92vh] z-10 animate-scale-in">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-white dark:bg-[#111118]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center font-bold text-sm">
              {String(companyName).charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white font-sans tracking-tight">
                  {companyName}
                </h2>
                {editStage && (
                  <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200/50 dark:border-blue-800/50">
                    {editStage}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-[11px] text-gray-500 dark:text-gray-400 flex-wrap">
                <span>POC: {editCogPoc || "Unassigned"} • {editSource || "Direct"}</span>
                {editFollowUpDate && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-full border border-purple-200/50 dark:border-purple-800/30">
                    Follow-up: {formatDisplayDate(editFollowUpDate)}
                  </span>
                )}
                {editDeadline && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 px-2 py-0.5 rounded-full border border-red-200/50 dark:border-red-800/30">
                    Deadline: {formatDisplayDate(editDeadline)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Top right Edit Lead Details button - prominently highlighted */}
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === "edit" ? "new" : "edit")}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                activeTab === "edit"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-gray-100 hover:bg-gray-200 dark:bg-white/10 dark:hover:bg-white/15 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-white/10"
              }`}
              title="Edit Lead Details"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{activeTab === "edit" ? "Back to Calendar" : "Edit Lead Details"}</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 dark:text-[#888899] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          {/* Top row — Action & Edit tabs */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTab("new")}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                activeTab === "new"
                  ? "border-2 border-gray-950 dark:border-white bg-white dark:bg-[#1A1A26] text-gray-950 dark:text-white font-bold shadow-sm"
                  : "border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white hover:bg-gray-100"
              }`}
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>New Conversation</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                activeTab === "history"
                  ? "border-2 border-gray-950 dark:border-white bg-white dark:bg-[#1A1A26] text-gray-950 dark:text-white font-bold shadow-sm"
                  : "border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white hover:bg-gray-100"
              }`}
            >
              <Clock className="w-3.5 h-3.5 stroke-[2]" />
              <span>History ({conversations.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("edit")}
              className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                activeTab === "edit"
                  ? "border-2 border-emerald-600 dark:border-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-bold shadow-sm"
                  : "border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white hover:bg-gray-100"
              }`}
            >
              <Edit3 className="w-3.5 h-3.5 stroke-[2]" />
              <span>Edit Lead Details</span>
            </button>
          </div>

          {activeTab === "edit" ? (
            /* ================= FULL LEAD EDIT FORM ================= */
            <form onSubmit={handleSaveLeadDetails} className="space-y-5 pt-1 animate-fade-in">
              {/* 1. Basic Information */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider font-mono">
                  <Building className="w-4 h-4 text-blue-500" />
                  <span>Basic Information</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={editCompany}
                      onChange={(e) => setEditCompany(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      Lead Date
                    </label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:border-blue-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      Cog POC
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Your name"
                      value={editCogPoc}
                      onChange={(e) => setEditCogPoc(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      Cog POC Email
                    </label>
                    <input
                      type="email"
                      placeholder="e.g. poc@cogculture.com"
                      value={editCogPocEmail}
                      onChange={(e) => setEditCogPocEmail(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      Lead Source
                    </label>
                    <select
                      value={editSource}
                      onChange={(e) => setEditSource(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:border-blue-500"
                    >
                      <option value="">Select Lead Source</option>
                      {SOURCE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                      {editSource && !SOURCE_OPTIONS.includes(editSource) && (
                        <option value={editSource}>{editSource}</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* Requirement multi-select */}
                <div>
                  <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1.5">
                    Requirements (Multi-Select)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {REQUIREMENT_OPTIONS.map((req) => {
                      const isSelected = editRequirements.includes(req);
                      return (
                        <button
                          key={req}
                          type="button"
                          onClick={() => toggleRequirement(req)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                            isSelected
                              ? "bg-blue-600 text-white shadow-xs"
                              : "bg-white dark:bg-[#161622] border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          <span>{req}</span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Custom other requirement chips */}
                  {editRequirements.filter((r) => !REQUIREMENT_OPTIONS.includes(r)).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {editRequirements
                        .filter((r) => !REQUIREMENT_OPTIONS.includes(r))
                        .map((r) => (
                          <span
                            key={r}
                            className="px-2 py-0.5 rounded-lg text-[11px] font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200 flex items-center gap-1"
                          >
                            <span>{r}</span>
                            <button
                              type="button"
                              onClick={() => toggleRequirement(r)}
                              className="hover:text-red-600 cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-2">
                    <input
                      type="text"
                      placeholder="Add custom requirement..."
                      value={otherReqInput}
                      onChange={(e) => setOtherReqInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddOtherRequirement();
                        }
                      }}
                      className="px-3 py-1.5 text-xs bg-white dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none flex-1"
                    />
                    <button
                      type="button"
                      onClick={handleAddOtherRequirement}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-gray-200 hover:bg-gray-200 cursor-pointer"
                    >
                      + Add
                    </button>
                  </div>
                </div>
              </div>

              {/* 2. Contact Details */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider font-mono">
                  <User className="w-4 h-4 text-emerald-500" />
                  <span>Contact Information</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      POC Name
                    </label>
                    <input
                      type="text"
                      placeholder="Client contact person"
                      value={editPocName}
                      onChange={(e) => setEditPocName(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      Contact No. / Phone
                    </label>
                    <input
                      type="text"
                      placeholder="+91..."
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      Email Id
                    </label>
                    <input
                      type="email"
                      placeholder="client@company.com"
                      value={editEmail}
                      onChange={(e) => setEditEmail(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              {/* 3. Commercials */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider font-mono">
                  <DollarSign className="w-4 h-4 text-indigo-500" />
                  <span>Commercials & Project Type</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      Type of Project
                    </label>
                    <select
                      value={editProjectType}
                      onChange={(e) => setEditProjectType(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:border-indigo-500"
                    >
                      <option value="Retainer">Retainer</option>
                      <option value="Project">Project</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300">
                        Retainer Cost
                      </label>
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 uppercase tracking-wide">
                        Monthly
                      </span>
                    </div>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs text-gray-400 font-mono">₹</span>
                      <input
                        type="text"
                        placeholder="e.g. 50,000"
                        value={editRetainerCost}
                        onChange={(e) => setEditRetainerCost(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 text-xs bg-white dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      Revenue Estimation
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs text-gray-400 font-mono">₹</span>
                      <input
                        type="text"
                        placeholder="e.g. 3,00,000"
                        value={editRevenueEst}
                        onChange={(e) => setEditRevenueEst(e.target.value)}
                        className="w-full pl-7 pr-3 py-2 text-xs bg-white dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. Pipeline, Stage & Follow-ups */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider font-mono">
                  <Layers className="w-4 h-4 text-purple-500" />
                  <span>Pipeline & Follow-ups</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      Stage
                    </label>
                    <select
                      value={editStage}
                      onChange={(e) => setEditStage(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:border-purple-500 font-semibold cursor-pointer"
                    >
                      {STAGE_OPTIONS.map((stg) => (
                        <option key={stg} value={stg}>
                          {stg}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      Status
                    </label>
                    <select
                      value={editStatus}
                      onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:border-purple-500 font-semibold cursor-pointer"
                    >
                      {STATUS_OPTIONS.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      Follow up Date
                    </label>
                    <input
                      type="date"
                      value={editFollowUpDate}
                      onChange={(e) => setEditFollowUpDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:border-purple-500 font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      Deadline Date
                    </label>
                    <input
                      type="date"
                      value={editDeadline}
                      onChange={(e) => setEditDeadline(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:border-purple-500 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      Intro Call
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Completed on 15 Oct"
                      value={editIntroCall}
                      onChange={(e) => setEditIntroCall(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      Follow-up 1
                    </label>
                    <input
                      type="text"
                      placeholder="Notes or date"
                      value={editFollowUp1}
                      onChange={(e) => setEditFollowUp1(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      Follow-up 2
                    </label>
                    <input
                      type="text"
                      placeholder="Notes or date"
                      value={editFollowUp2}
                      onChange={(e) => setEditFollowUp2(e.target.value)}
                      className="w-full px-3 py-2 text-xs bg-white dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:border-purple-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    LinkedIn / Ad / Referral Link
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="https://..."
                      value={editLinkedinAdLink}
                      onChange={(e) => setEditLinkedinAdLink(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 text-xs bg-white dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:border-purple-500 font-mono"
                    />
                    {editLinkedinAdLink && (
                      <a
                        href={editLinkedinAdLink.startsWith("http") ? editLinkedinAdLink : `https://${editLinkedinAdLink}`}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute right-2.5 top-2.5 text-gray-400 hover:text-blue-500"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* 5. Remarks & Messages */}
              <div className="p-4 rounded-xl border border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/[0.02] space-y-3">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider font-mono">
                  <FileText className="w-4 h-4 text-amber-500" />
                  <span>Prospect Message & Updates</span>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    Message from Prospect
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Original inbound message or inquiry text..."
                    value={editMessageFromProspect}
                    onChange={(e) => setEditMessageFromProspect(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    Remarks / Updates
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Latest internal notes, next action steps..."
                    value={editRemarks}
                    onChange={(e) => setEditRemarks(e.target.value)}
                    className="w-full px-3 py-2 text-xs bg-white dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-lg text-gray-900 dark:text-white outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* Save & Cancel Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab("new")}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLead}
                  className="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-all cursor-pointer shadow-md flex items-center gap-2 disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingLead ? "Saving..." : "Save Changes"}</span>
                </button>
              </div>
            </form>
          ) : (
            /* ================= CONVERSATION / CALENDAR VIEWS ================= */
            <>
              {/* Sleek compact Calendar */}
              <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161622] p-3 sm:p-3.5 shadow-xs">
                {/* Month & Navigation Header */}
                <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-white/5 mb-2">
                  <span className="text-xs sm:text-sm font-bold text-gray-900 dark:text-white font-sans">
                    {MONTH_NAMES[currentMonth]} {currentYear}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-1 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                      title="Previous Month"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="p-1 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                      title="Next Month"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Weekday columns */}
                <div className="grid grid-cols-7 text-center text-[10px] sm:text-xs font-semibold text-gray-500 dark:text-[#888899] py-1 border-b border-gray-100 dark:border-white/5 mb-1">
                  {DAY_NAMES.map((d) => (
                    <div key={d} className="py-0.5">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Calendar Days Grid */}
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((cell, idx) => {
                    const isSelected = selectedDate === cell.dateStr;
                    const hasConversations = recordedDatesSet.has(cell.dateStr);

                    return (
                      <button
                        type="button"
                        key={`${cell.dateStr}-${idx}`}
                        onClick={() => setSelectedDate(cell.dateStr)}
                        className={`h-8 sm:h-9 flex flex-col items-center justify-center rounded-lg text-xs transition-all cursor-pointer relative ${
                          isSelected
                            ? "border-2 border-gray-900 dark:border-white bg-gray-50 dark:bg-white/10 font-bold text-gray-950 dark:text-white shadow-xs"
                            : cell.isCurrentMonth
                            ? "text-gray-800 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5"
                            : "text-gray-300 dark:text-gray-600 hover:bg-gray-50 dark:hover:bg-white/5"
                        }`}
                      >
                        <span className="leading-none">{cell.dayNum}</span>
                        {/* Mark dates on which conversations have been recorded */}
                        {hasConversations && (
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 dark:bg-blue-400 mt-0.5 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* If selected date has conversations, show enhanced summary widget */}
              {selectedDateConversations.length > 0 && activeTab === "new" && (
                <div className="p-3.5 rounded-xl border border-blue-200/60 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-blue-900 dark:text-blue-300">
                    <span className="flex items-center gap-1.5 font-sans">
                      <CalendarCheck className="w-3.5 h-3.5 text-blue-600" />
                      Recorded on {selectedDate} ({selectedDateConversations.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab("history")}
                      className="text-xs font-mono text-blue-600 hover:underline cursor-pointer"
                    >
                      View All History →
                    </button>
                  </div>
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {selectedDateConversations.map((c) => (
                      <div
                        key={c.id}
                        className="p-3 rounded-lg bg-white dark:bg-[#111118] border border-blue-100 dark:border-white/5 flex items-start justify-between gap-3 shadow-xs"
                      >
                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-gray-200">
                              {c.conversation_type}
                            </span>
                            <span className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 font-sans">
                              <User className="w-3 h-3 text-gray-400 shrink-0" />
                              Added by{" "}
                              <span className="font-semibold text-gray-700 dark:text-gray-300">
                                {c.author || editCogPoc || "Cog Team"}
                              </span>
                            </span>
                          </div>
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100 whitespace-pre-wrap leading-relaxed">
                            {c.message}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteConversation(c.id)}
                          className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors cursor-pointer shrink-0 mt-0.5"
                          title="Delete entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Bottom section: New vs History */}
              {activeTab === "new" ? (
                /* Conversation Form */
                <form onSubmit={handleSaveConversation} className="space-y-3 pt-1">
                  <div>
                    <label className="text-xs font-semibold text-gray-900 dark:text-white font-sans block mb-1.5">
                      Conversation Type
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {CONVERSATION_TYPES.map(({ id, label, icon: Icon }) => {
                        const isSelected = selectedType === id;
                        return (
                          <button
                            key={id}
                            type="button"
                            onClick={() => setSelectedType(id)}
                            className={`flex items-center justify-center gap-2 py-2 px-3.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs whitespace-nowrap ${
                              isSelected
                                ? "border-2 border-gray-900 dark:border-white bg-gray-50 dark:bg-white/10 text-gray-950 dark:text-white font-bold"
                                : "border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161622] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
                            }`}
                          >
                            <Icon className="w-3.5 h-3.5 shrink-0" />
                            <span className="whitespace-nowrap">{label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Message input */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-gray-900 dark:text-white font-sans block">
                        Message
                      </label>
                      <span className="text-[11px] font-mono text-gray-400">
                        Date: {selectedDate}
                      </span>
                    </div>
                    <div className="relative flex items-center">
                      <input
                        type="text"
                        placeholder="Type your message..."
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        className="w-full pl-3.5 pr-20 py-2.5 text-xs sm:text-sm bg-white dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white font-sans outline-none focus:border-gray-900 dark:focus:border-white transition-all shadow-xs"
                      />
                      <button
                        type="submit"
                        disabled={saving || !message.trim()}
                        className={`absolute right-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer flex items-center gap-1 ${
                          message.trim() && !saving
                            ? "bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-200 text-white dark:text-gray-900 shadow-xs"
                            : "bg-gray-100 dark:bg-white/5 text-gray-400 cursor-not-allowed"
                        }`}
                      >
                        <Send className="w-3 h-3" />
                        <span>{saving ? "Saving..." : "Save"}</span>
                      </button>
                    </div>
                  </div>
                </form>
              ) : (
                /* History View: all touchpoints */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-900 dark:text-white font-sans">
                      Conversation History
                    </span>
                    <span className="text-xs font-mono text-gray-400">
                      {conversations.length} {conversations.length === 1 ? "entry" : "entries"}
                    </span>
                  </div>

                  {loading ? (
                    <div className="py-12 text-center text-xs text-gray-400 font-mono">
                      Loading conversation history...
                    </div>
                  ) : conversations.length === 0 ? (
                    /* Empty state */
                    <div className="py-10 text-center rounded-2xl border border-dashed border-gray-200 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 p-6">
                      <Clock className="w-8 h-8 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                        No conversations recorded yet
                      </p>
                      <p className="text-[11px] text-gray-400 mt-1 max-w-sm mx-auto">
                        Select a date on the calendar, pick a conversation type, and record call or meeting notes.
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveTab("new")}
                        className="mt-3 px-3.5 py-1.5 rounded-xl border border-gray-900 dark:border-white text-xs font-semibold hover:bg-gray-900 hover:text-white dark:hover:bg-white dark:hover:text-gray-900 transition-all cursor-pointer"
                      >
                        + Add First Conversation
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                      {conversations.map((c) => {
                        const typeObj = CONVERSATION_TYPES.find((t) => t.id === c.conversation_type);
                        const IconComponent = typeObj ? typeObj.icon : MessageCircle;

                        return (
                          <div
                            key={c.id}
                            className="p-3.5 rounded-xl border border-gray-200/80 dark:border-white/10 bg-white dark:bg-[#161622] flex items-start justify-between gap-3 shadow-xs hover:border-gray-300 dark:hover:border-white/20 transition-all"
                          >
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center shrink-0 mt-0.5 text-gray-800 dark:text-gray-200">
                                <IconComponent className="w-4 h-4" />
                              </div>
                              <div className="space-y-1.5 min-w-0 flex-1">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                  <span className="text-xs font-bold text-gray-900 dark:text-white">
                                    {c.conversation_type}
                                  </span>
                                  <span className="text-[11px] font-mono text-gray-500 bg-gray-50 dark:bg-white/5 px-2 py-0.5 rounded border border-gray-100 dark:border-white/5">
                                    {formatDisplayDate(c.date)}
                                  </span>
                                  {c.created_at && (
                                    <span className="text-[11px] text-gray-400 font-mono">
                                      {new Date(c.created_at).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                  )}
                                  <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 flex items-center gap-1 font-sans ml-auto">
                                    <User className="w-3 h-3 text-gray-400 shrink-0" />
                                    Added by{" "}
                                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                                      {c.author || editCogPoc || "Cog Team"}
                                    </span>
                                  </span>
                                </div>
                                <p className="text-sm font-medium text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words leading-relaxed">
                                  {c.message}
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteConversation(c.id)}
                              className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 dark:hover:bg-white/5 transition-colors cursor-pointer shrink-0"
                              title="Delete entry"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

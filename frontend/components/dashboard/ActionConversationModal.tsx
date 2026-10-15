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
  Info
} from "lucide-react";
import { api } from "../../lib/api";
import { Conversation } from "../../lib/types";
import { toast } from "sonner";

interface ActionConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: Record<string, any> | null;
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

// Helper to format Date object into YYYY-MM-DD
const formatDateStr = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

// Helper to parse string dates into Date
const parseDateSafe = (val: any): Date => {
  if (!val) return new Date();
  const str = String(val).trim();
  const parts = str.split(/[-/.]/);
  if (parts.length === 3) {
    const p0 = parseInt(parts[0], 10);
    const p1 = parseInt(parts[1], 10);
    const p2 = parseInt(parts[2], 10);
    if (!isNaN(p0) && !isNaN(p1) && !isNaN(p2)) {
      if (parts[0].length === 4) return new Date(p0, p1 - 1, p2);
      if (parts[2].length === 4) return new Date(p2, p1 - 1, p0);
    }
  }
  const parsed = Date.parse(str);
  return isNaN(parsed) ? new Date() : new Date(parsed);
};

export default function ActionConversationModal({
  isOpen,
  onClose,
  lead,
}: ActionConversationModalProps) {
  // Navigation & view modes
  const [activeTab, setActiveTab] = useState<"new" | "history">("new");
  const [selectedType, setSelectedType] = useState<ConversationTypeId>("Call");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  // Calendar state: month index (0-11) and full year
  const [currentYear, setCurrentYear] = useState<number>(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(() => new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string>(() => formatDateStr(new Date()));

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
    }
  }, [isOpen, lead]);

  const loadConversations = async () => {
    if (!leadId) return;
    try {
      setLoading(true);
      const data = await api.getConversations(leadId);
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

    // Trailing days from next month to complete rows of 7 (up to 35 or 42 cells)
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
      const newEntry = await api.addConversation({
        lead_id: leadId,
        date: selectedDate,
        conversation_type: selectedType,
        message: message.trim(),
        lead_key: String(companyName).trim(),
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-fade-in">
      {/* Click outside backdrop to close */}
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-3xl bg-white dark:bg-[#111118] border border-gray-200 dark:border-white/10 shadow-2xl rounded-2xl overflow-hidden flex flex-col max-h-[92vh] z-10 animate-scale-in">
        {/* Header - The Action heading is already implemented here */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-white dark:bg-[#111118]">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white font-sans tracking-tight">
              Action
            </h2>
            <div className="flex items-center gap-2 pl-3 border-l border-gray-200 dark:border-white/10 text-xs">
              <span className="font-semibold text-gray-700 dark:text-gray-200 truncate max-w-[280px]">
                {companyName}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 dark:text-[#888899] hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-all cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* 1. Top row — Action buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setActiveTab("new")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                activeTab === "new"
                  ? "border-2 border-gray-950 dark:border-white bg-white dark:bg-[#1A1A26] text-gray-950 dark:text-white font-bold shadow-sm"
                  : "border border-gray-250 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white hover:bg-gray-100"
              }`}
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>New Conversation</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("history")}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                activeTab === "history"
                  ? "border-2 border-gray-950 dark:border-white bg-white dark:bg-[#1A1A26] text-gray-950 dark:text-white font-bold shadow-sm"
                  : "border border-gray-250 dark:border-white/10 bg-gray-50/50 dark:bg-white/5 text-gray-600 dark:text-gray-400 hover:text-gray-950 dark:hover:text-white hover:bg-gray-100"
              }`}
            >
              <Clock className="w-4 h-4 stroke-[2]" />
              <span>History ({conversations.length})</span>
            </button>
          </div>

          {/* 2. Middle section — Calendar */}
          <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161622] p-4 shadow-xs">
            {/* Month & Navigation Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-white/5 mb-3">
              <span className="text-sm font-bold text-gray-900 dark:text-white font-sans">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                  title="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 rounded-lg border border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 text-gray-700 dark:text-gray-300 transition-colors cursor-pointer"
                  title="Next Month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Weekday columns */}
            <div className="grid grid-cols-7 text-center text-xs font-semibold text-gray-500 dark:text-[#888899] py-1 border-b border-gray-100 dark:border-white/5 mb-1">
              {DAY_NAMES.map((d) => (
                <div key={d} className="py-1">
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
                    className={`h-11 sm:h-12 flex flex-col items-center justify-center rounded-xl text-xs transition-all cursor-pointer relative ${
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
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-900 dark:bg-white mt-1 shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* If the selected date has conversations, show a helpful summary widget */}
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
                  className="text-[11px] font-mono text-blue-600 hover:underline cursor-pointer"
                >
                  View All History →
                </button>
              </div>
              <div className="space-y-1.5 max-h-32 overflow-y-auto pr-1">
                {selectedDateConversations.map((c) => (
                  <div
                    key={c.id}
                    className="p-2 rounded-lg bg-white dark:bg-[#111118] border border-blue-100 dark:border-white/5 flex items-start justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold font-mono px-1.5 py-0.2 rounded bg-gray-100 dark:bg-white/10 text-gray-800 dark:text-gray-200">
                          {c.conversation_type}
                        </span>
                      </div>
                      <p className="text-gray-800 dark:text-gray-200 truncate">{c.message}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteConversation(c.id)}
                      className="p-1 text-gray-400 hover:text-red-500 rounded transition-colors cursor-pointer shrink-0"
                      title="Delete entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 3. Bottom section: Tab dependent */}
          {activeTab === "new" ? (
            /* Conversation Form */
            <form onSubmit={handleSaveConversation} className="space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                {/* Left column: Conversation type */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-900 dark:text-white font-sans block">
                    Conversation Type
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {CONVERSATION_TYPES.map(({ id, label, icon: Icon }) => {
                      const isSelected = selectedType === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setSelectedType(id)}
                          className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs ${
                            isSelected
                              ? "border-2 border-gray-900 dark:border-white bg-gray-50 dark:bg-white/10 text-gray-950 dark:text-white font-bold"
                              : "border border-gray-200 dark:border-white/10 bg-white dark:bg-[#161622] text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5"
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right column: Message input */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-gray-900 dark:text-white font-sans block">
                      Message
                    </label>
                    <span className="text-[10px] font-mono text-gray-400">
                      Date: {selectedDate}
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="Type your message..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="w-full pl-3.5 pr-20 py-2.5 text-xs bg-white dark:bg-[#161622] border border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-white font-sans outline-none focus:border-gray-900 dark:focus:border-white transition-all shadow-xs"
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
              </div>
            </form>
          ) : (
            /* History View: previous conversations with newest first */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-900 dark:text-white font-sans">
                  Conversation History
                </span>
                <span className="text-[11px] font-mono text-gray-400">
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
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {conversations.map((c) => {
                    const typeObj = CONVERSATION_TYPES.find((t) => t.id === c.conversation_type);
                    const IconComponent = typeObj ? typeObj.icon : MessageCircle;

                    return (
                      <div
                        key={c.id}
                        className="p-3 rounded-xl border border-gray-200/80 dark:border-white/10 bg-white dark:bg-[#161622] flex items-start justify-between gap-3 shadow-xs hover:border-gray-300 dark:hover:border-white/20 transition-all"
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white/10 flex items-center justify-center shrink-0 mt-0.5 text-gray-800 dark:text-gray-200">
                            <IconComponent className="w-4 h-4" />
                          </div>
                          <div className="space-y-1 min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-gray-900 dark:text-white">
                                {c.conversation_type}
                              </span>
                              <span className="text-[10px] font-mono text-gray-400 bg-gray-50 dark:bg-white/5 px-2 py-0.5 rounded border border-gray-100 dark:border-white/5">
                                {c.date}
                              </span>
                              {c.created_at && (
                                <span className="text-[10px] text-gray-400 font-mono">
                                  {new Date(c.created_at).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
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
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

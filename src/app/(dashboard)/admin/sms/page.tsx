"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  MessageSquare, Search, RefreshCw, Trash2, CheckCheck,
  Filter, ChevronLeft, ChevronRight, Smartphone, Circle,
  X, Mail, MailOpen, Clock, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { relativeTime, fullDateTime } from "@/lib/utils";

/* ─── Types ──────────────────────────────────────────────────────────────── */
interface SmsMessage {
  id: string;
  deviceId: string;
  deviceName: string;
  sender: string;
  body: string;
  receivedAt: string;
  createdAt: string;
  isRead: boolean;
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const res = await fetch(url, { credentials: "include", ...options });
  return res;
}

/* ─── MessageDetail panel ────────────────────────────────────────────────── */
function MessageDetail({
  msg,
  onClose,
  onDelete,
}: {
  msg: SmsMessage;
  onClose: () => void;
  onDelete: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      const res = await apiFetch("/api/admin/sms", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [msg.id] }),
      });
      if (!res.ok) throw new Error("Failed");
      toast.success("Message deleted");
      onDelete(msg.id);
      onClose();
    } catch {
      toast.error("Failed to delete message");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-black/[0.05]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-[#E8F1EE] flex items-center justify-center shrink-0">
            <MessageSquare className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="font-bold font-manrope text-on-surface text-sm">{msg.sender}</p>
            <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5">
              <Smartphone className="w-3 h-3" />
              {msg.deviceName || msg.deviceId.slice(0, 12) + "…"}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-2 rounded-xl hover:bg-surface-container transition-colors"
        >
          <X className="w-4 h-4 text-on-surface-variant" />
        </button>
      </div>

      {/* Meta */}
      <div className="px-6 py-3 bg-surface-container/40 border-b border-black/[0.04] flex flex-wrap gap-4 text-xs text-on-surface-variant">
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          Received: {fullDateTime(msg.receivedAt)}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          Stored: {fullDateTime(msg.createdAt)}
        </span>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="bg-surface-container/30 border border-black/[0.05] rounded-2xl p-5">
          <p className="text-sm text-on-surface leading-relaxed whitespace-pre-wrap font-body">
            {msg.body}
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 py-4 border-t border-black/[0.05] flex justify-end">
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold font-manrope text-red-600 border border-red-200 rounded-xl hover:bg-red-50 disabled:opacity-50 transition-all"
        >
          <Trash2 className="w-4 h-4" />
          {deleting ? "Deleting…" : "Delete"}
        </button>
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────────────────────── */
export default function SmsInboxPage() {
  const [messages, setMessages]     = useState<SmsMessage[]>([]);
  const [total, setTotal]           = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState<SmsMessage | null>(null);

  // Filters
  const [search, setSearch]         = useState("");
  const [filterDevice, setFilterDevice] = useState("");
  const [filterUnread, setFilterUnread] = useState(false);
  const [page, setPage]             = useState(0);
  const LIMIT = 50;

  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Fetch messages ─────────────────────────────────────────────────── */
  const fetchMessages = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        page:  String(page),
      });
      if (search)       params.set("search",   search);
      if (filterDevice) params.set("deviceId", filterDevice);
      if (filterUnread) params.set("unread",   "true");

      const res  = await apiFetch(`/api/admin/sms?${params}`);
      const data = await res.json() as {
        messages: SmsMessage[];
        total: number;
        unreadCount: number;
      };
      setMessages(data.messages ?? []);
      setTotal(data.total ?? 0);
      setUnreadCount(data.unreadCount ?? 0);
    } catch {
      toast.error("Failed to load messages");
    } finally {
      setLoading(false);
    }
  }, [page, search, filterDevice, filterUnread]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  /* debounce search */
  function handleSearchChange(val: string) {
    setSearch(val);
    setPage(0);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => fetchMessages(), 400);
  }

  /* ── Mark as read (single) ──────────────────────────────────────────── */
  async function markRead(id: string) {
    setMessages((prev) =>
      prev.map((m) => (m.id === id ? { ...m, isRead: true } : m))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
    await apiFetch("/api/admin/sms", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id] }),
    }).catch(() => {});
  }

  /* ── Mark ALL as read ───────────────────────────────────────────────── */
  async function markAllRead() {
    try {
      const res = await apiFetch("/api/admin/sms", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) throw new Error();
      setMessages((prev) => prev.map((m) => ({ ...m, isRead: true })));
      setUnreadCount(0);
      toast.success("All messages marked as read");
    } catch {
      toast.error("Failed to mark all as read");
    }
  }

  /* ── Delete all ─────────────────────────────────────────────────────── */
  async function deleteAll() {
    if (!confirm("Delete ALL messages? This cannot be undone.")) return;
    try {
      const res = await apiFetch("/api/admin/sms", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      if (!res.ok) throw new Error();
      setMessages([]);
      setTotal(0);
      setUnreadCount(0);
      setSelected(null);
      toast.success("All messages deleted");
    } catch {
      toast.error("Failed to delete messages");
    }
  }

  /* ── Select message ─────────────────────────────────────────────────── */
  function openMessage(msg: SmsMessage) {
    setSelected(msg);
    if (!msg.isRead) markRead(msg.id);
  }

  /* ── Handle delete from detail panel ────────────────────────────────── */
  function handleDetailDelete(id: string) {
    setMessages((prev) => prev.filter((m) => m.id !== id));
    setTotal((t) => Math.max(0, t - 1));
  }

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  /* ─────────────────────────────────────────────────────────────────────── */
  return (
    <div className="flex flex-col h-full">
      {/* ── Page header ────────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4 border-b border-black/[0.05] bg-white/80">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#E8F1EE] rounded-xl">
              <MessageSquare className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-headline text-2xl font-extrabold text-[#134235] tracking-tight">
                SMS Inbox
              </h1>
              <p className="text-sm text-on-surface-variant">
                Messages received by Android agent devices
              </p>
            </div>
            {unreadCount > 0 && (
              <span className="ml-1 px-2.5 py-0.5 rounded-full bg-primary text-on-primary text-xs font-bold font-manrope">
                {unreadCount} unread
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold font-manrope text-primary border border-primary/20 rounded-xl hover:bg-[#E8F1EE] transition-all"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Mark all read
              </button>
            )}
            <button
              onClick={() => fetchMessages({ silent: true })}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold font-manrope text-on-surface-variant border border-outline-variant rounded-xl hover:bg-surface-container transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
            {messages.length > 0 && (
              <button
                onClick={deleteAll}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold font-manrope text-red-600 border border-red-200 rounded-xl hover:bg-red-50 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* ── Filter bar ─────────────────────────────────────────────── */}
        <div className="mt-4 flex flex-col sm:flex-row gap-2 max-w-7xl mx-auto">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Search sender or message…"
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-outline-variant rounded-xl bg-surface-container/30 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 placeholder:text-on-surface-variant/50 font-body"
            />
            {search && (
              <button
                onClick={() => { setSearch(""); setPage(0); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-surface-container"
              >
                <X className="w-3.5 h-3.5 text-on-surface-variant" />
              </button>
            )}
          </div>

          {/* Device filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-on-surface-variant" />
            <input
              type="text"
              placeholder="Device ID…"
              value={filterDevice}
              onChange={(e) => { setFilterDevice(e.target.value); setPage(0); }}
              className="pl-9 pr-4 py-2.5 text-sm border border-outline-variant rounded-xl bg-surface-container/30 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 placeholder:text-on-surface-variant/50 font-body w-44"
            />
          </div>

          {/* Unread toggle */}
          <label className="flex items-center gap-2 px-3 py-2 border border-outline-variant rounded-xl cursor-pointer hover:bg-surface-container transition-all text-sm font-manrope text-on-surface-variant select-none">
            <input
              type="checkbox"
              className="accent-primary w-3.5 h-3.5"
              checked={filterUnread}
              onChange={(e) => { setFilterUnread(e.target.checked); setPage(0); }}
            />
            Unread only
          </label>
        </div>
      </div>

      {/* ── Content area ───────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden max-w-7xl mx-auto w-full px-6 py-4 gap-4">
        {/* Message list */}
        <div
          className={[
            "flex flex-col bg-white border border-black/[0.05] rounded-2xl overflow-hidden premium-shadow transition-all duration-300",
            selected ? "hidden md:flex md:w-2/5 lg:w-1/3" : "flex flex-1",
          ].join(" ")}
        >
          {/* List header */}
          <div className="px-4 py-3 border-b border-black/[0.04] flex items-center justify-between bg-surface-container/20">
            <span className="text-xs font-bold font-manrope text-on-surface-variant uppercase tracking-wider">
              {total} message{total !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Loading skeleton */}
          {loading && (
            <div className="flex-1 overflow-y-auto divide-y divide-black/[0.03]">
              {Array(8).fill(0).map((_, i) => (
                <div key={i} className="px-4 py-4 flex gap-3 animate-pulse">
                  <div className="w-9 h-9 rounded-full bg-surface-container shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-surface-container rounded w-1/3" />
                    <div className="h-3 bg-surface-container rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && messages.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8 text-on-surface-variant" />
              </div>
              <p className="font-bold font-manrope text-on-surface">No messages found</p>
              <p className="text-sm text-on-surface-variant mt-1.5">
                {search || filterDevice || filterUnread
                  ? "Try adjusting your filters"
                  : "SMS messages from agent devices will appear here"}
              </p>
            </div>
          )}

          {/* Message rows */}
          {!loading && messages.length > 0 && (
            <div className="flex-1 overflow-y-auto divide-y divide-black/[0.03]">
              {messages.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => openMessage(msg)}
                  className={[
                    "w-full text-left px-4 py-3.5 flex gap-3 hover:bg-surface-container/40 transition-colors group",
                    selected?.id === msg.id ? "bg-[#E8F1EE]/60" : "",
                    !msg.isRead ? "bg-[#E8F1EE]/20" : "",
                  ].join(" ")}
                >
                  {/* Avatar / unread dot */}
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full bg-[#E8F1EE] flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">
                        {msg.sender.slice(-2)}
                      </span>
                    </div>
                    {!msg.isRead && (
                      <Circle
                        className="w-2.5 h-2.5 text-primary fill-primary absolute -top-0.5 -right-0.5"
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={[
                          "text-sm truncate",
                          !msg.isRead
                            ? "font-bold text-on-surface"
                            : "font-medium text-on-surface/80",
                        ].join(" ")}
                      >
                        {msg.sender}
                      </span>
                      <span className="text-[10px] text-on-surface-variant shrink-0">
                        {relativeTime(msg.receivedAt)}
                      </span>
                    </div>
                    <p className="text-xs text-on-surface-variant truncate mt-0.5">
                      {msg.body}
                    </p>
                    <div className="flex items-center gap-1 mt-1">
                      <Smartphone className="w-2.5 h-2.5 text-on-surface-variant/50" />
                      <span className="text-[10px] text-on-surface-variant/50 truncate">
                        {msg.deviceName || msg.deviceId.slice(0, 10) + "…"}
                      </span>
                      {msg.isRead
                        ? <MailOpen className="w-2.5 h-2.5 text-on-surface-variant/40 ml-auto" />
                        : <Mail className="w-2.5 h-2.5 text-primary ml-auto" />
                      }
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="px-4 py-3 border-t border-black/[0.04] flex items-center justify-between">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold font-manrope rounded-lg border border-outline-variant disabled:opacity-40 hover:bg-surface-container transition-all"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Prev
              </button>
              <span className="text-xs text-on-surface-variant font-manrope">
                {page + 1} / {totalPages}
              </span>
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold font-manrope rounded-lg border border-outline-variant disabled:opacity-40 hover:bg-surface-container transition-all"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {selected ? (
          <div className="flex-1 bg-white border border-black/[0.05] rounded-2xl overflow-hidden premium-shadow flex flex-col">
            <MessageDetail
              msg={selected}
              onClose={() => setSelected(null)}
              onDelete={handleDetailDelete}
            />
          </div>
        ) : (
          <div className="hidden md:flex flex-1 bg-white border border-black/[0.05] rounded-2xl premium-shadow items-center justify-center">
            <div className="text-center text-on-surface-variant/50 select-none">
              <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-manrope">Select a message to view</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

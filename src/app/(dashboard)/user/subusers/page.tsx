"use client";
import { useState } from "react";
import { useModalEffect } from "@/lib/hooks/useModalEffect";
import { useSubUsers } from "@/lib/hooks/user/useSubUsers";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { WalletAmount } from "@/components/admin/WalletAmount";
import { relativeTime, getInitials } from "@/lib/utils";
import { apiFetch } from "@/lib/functions";
import Link from "next/link";
import { toast } from "sonner";
import { Search, UserPlus, X, Users, ArrowRight, Wallet, Clock } from "lucide-react";

function RegisterSubUserDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const containerRef = useModalEffect(open);
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [successData, setSuccessData] = useState<{ displayName: string; username: string; email: string; pass: string; pin: string } | null>(null);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    const genPass = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-2).toUpperCase();
    const genPin = Math.floor(1000 + Math.random() * 9000).toString();
    try {
      await apiFetch<{ success: boolean; uid: string }>("/api/user/subusers", {
        method: "POST",
        body: JSON.stringify({ displayName, username, email: email || undefined, password: genPass, phoneNumber: phoneNumber || undefined, pin: genPin }),
      });
      toast.success("User created successfully");
      setSuccessData({ displayName, username, email, pass: genPass, pin: genPin });
      onSuccess();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    setDisplayName(""); setUsername(""); setEmail(""); setPhoneNumber(""); setSuccessData(null);
    onClose();
  }

  function handleCopy() {
    if (!successData) return;
    const text = `Registration Successful\nName: ${successData.displayName}\nUsername: ${successData.username}\nEmail: ${successData.email || "N/A"}\nPassword: ${successData.pass}\nPIN: ${successData.pin}`;
    navigator.clipboard.writeText(text);
    toast.success("Credentials copied to clipboard!");
  }

  if (successData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div className="relative w-full max-w-md rounded-2xl border border-black/5 bg-white p-8 premium-shadow text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
            <UserPlus className="h-6 w-6" />
          </div>
          <h2 className="font-headline text-2xl font-bold text-[#134235] mb-2">User Created!</h2>
          <p className="text-sm text-on-surface-variant mb-6">Share these credentials with the user securely.</p>
          <div className="bg-surface rounded-xl p-4 text-left border border-black/5 space-y-3 mb-6">
            <div><span className="text-xs font-bold text-on-surface-variant uppercase">Name:</span> <p className="font-semibold">{successData.displayName}</p></div>
            <div><span className="text-xs font-bold text-on-surface-variant uppercase">Username:</span> <p className="font-mono font-bold text-primary">{successData.username}</p></div>
            {successData.email && <div><span className="text-xs font-bold text-on-surface-variant uppercase">Email:</span> <p className="font-medium">{successData.email}</p></div>}
            <div className="grid grid-cols-2 gap-4">
              <div><span className="text-xs font-bold text-on-surface-variant uppercase">Password:</span> <p className="font-mono font-bold text-orange-600">{successData.pass}</p></div>
              <div><span className="text-xs font-bold text-on-surface-variant uppercase">PIN:</span> <p className="font-mono font-bold text-violet-600">{successData.pin}</p></div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleClose} className="flex-1 rounded-xl border border-outline-variant px-5 py-3 text-sm font-semibold hover:bg-surface-container transition-all">Done</button>
            <button onClick={handleCopy} className="flex-1 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white hover:opacity-90 transition-all shadow-lg shadow-primary/20">Copy All</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && handleClose()} />
      <div ref={containerRef} className="relative w-full max-w-lg rounded-2xl border border-black/5 bg-white p-8 premium-shadow">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-headline text-xl font-bold text-[#134235]">Create Sub-User</h2>
            <p className="mt-1 text-sm text-on-surface-variant">Credentials will be generated automatically.</p>
          </div>
          <button type="button" onClick={handleClose} disabled={saving} className="rounded-xl p-2 text-on-surface-variant hover:bg-surface-container transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope">Full Name</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required
              className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              placeholder="e.g. Md. Rahim Uddin" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope">Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} required
                className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="Unique username" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope">Email <span className="text-outline font-normal normal-case tracking-normal">optional</span></label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                placeholder="user@example.com" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope">Phone <span className="text-outline font-normal normal-case tracking-normal">optional</span></label>
            <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              placeholder="+8801XXXXXXXXX" />
          </div>
          <div className="rounded-xl border border-primary/10 bg-primary/5 px-4 py-3 text-xs text-primary font-manrope font-medium">
            Password and 4-digit PIN will be auto-generated.
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={handleClose} disabled={saving}
              className="rounded-xl border border-outline-variant px-5 py-2.5 text-sm font-semibold hover:bg-surface-container disabled:opacity-50 transition-all">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:opacity-90 disabled:opacity-50 shadow-lg shadow-primary/20 transition-all">
              <UserPlus className="h-4 w-4" />
              {saving ? "Creating..." : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SubUsersPage() {
  const [search, setSearch] = useState("");
  const [registerOpen, setRegisterOpen] = useState(false);
  const { users, loading, refetch } = useSubUsers();

  const filteredUsers = users.filter(u =>
    search === "" ||
    u.displayName.toLowerCase().includes(search.toLowerCase()) ||
    (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.username || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 sm:p-10 max-w-4xl mx-auto space-y-8 pb-12">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface mb-2">My Users</h1>
          <p className="text-on-surface-variant font-body text-lg">Manage accounts you have created.</p>
        </div>
        <button type="button" onClick={() => setRegisterOpen(true)}
          className="bg-primary text-on-primary px-6 py-3.5 rounded-xl font-bold font-manrope flex items-center gap-2 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
          <UserPlus className="h-5 w-5" /> Create Sub-User
        </button>
      </section>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email or username…"
          className="w-full pl-11 pr-4 py-2.5 border border-outline-variant bg-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
      </div>

      {/* Summary */}
      <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope">
        {loading ? "Loading…" : `${filteredUsers.length} User${filteredUsers.length !== 1 ? "s" : ""}`}
      </p>

      {/* Cards */}
      {loading ? (
        <div className="space-y-3">
          {Array(4).fill(0).map((_, i) => (
            <div key={i} className="bg-white border border-black/5 rounded-2xl p-5 animate-pulse premium-shadow">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-surface-container shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-surface-container rounded w-1/3" />
                  <div className="h-3 bg-surface-container rounded w-1/2" />
                </div>
                <div className="h-8 bg-surface-container rounded-xl w-24" />
              </div>
            </div>
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="bg-white border border-dashed border-outline-variant rounded-2xl px-6 py-16 text-center premium-shadow">
          <div className="w-14 h-14 rounded-2xl bg-surface-container mx-auto flex items-center justify-center mb-4">
            <Users className="w-7 h-7 text-on-surface-variant" />
          </div>
          <p className="font-manrope font-bold text-lg text-on-surface mb-1">No users found</p>
          <p className="text-sm text-on-surface-variant">You haven't created any sub-users yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user) => (
            <div key={user.uid} className="bg-white border border-black/5 rounded-2xl p-5 premium-shadow hover:border-primary/20 hover:shadow-md transition-all group">
              <div className="flex items-center gap-4">
                {/* Avatar */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold font-manrope text-lg shadow-inner shrink-0">
                  {getInitials(user.displayName)}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-on-surface font-manrope">{user.displayName}</p>
                    <StatusBadge status={user.status} />
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {user.username && (
                      <span className="text-xs font-mono text-on-surface-variant bg-surface-container px-2 py-0.5 rounded">@{user.username}</span>
                    )}
                    {user.email && (
                      <span className="text-xs text-on-surface-variant truncate">{user.email}</span>
                    )}
                  </div>
                </div>

                {/* Stats + Action */}
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 text-[#134235]">
                    <Wallet className="w-3.5 h-3.5 text-primary" />
                    <span className="font-bold font-manrope text-sm"><WalletAmount amount={user.walletBalance} /></span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-on-surface-variant font-manrope">
                    <Clock className="w-3 h-3" />
                    {relativeTime(user.createdAt as string)}
                  </div>
                </div>

                <Link href={`/user/subusers/${user.uid}`}
                  className="ml-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold font-manrope text-primary bg-primary/5 hover:bg-primary/10 transition-colors shrink-0">
                  Manage <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}

      <RegisterSubUserDialog
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onSuccess={refetch}
      />
    </div>
  );
}

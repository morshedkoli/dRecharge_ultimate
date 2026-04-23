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
import { Search, UserPlus, X, Users, ArrowRight } from "lucide-react";

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

    // Auto generate 8 char password and 4 digit PIN
    const genPass = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-2).toUpperCase();
    const genPin = Math.floor(1000 + Math.random() * 9000).toString();

    try {
      const result = await apiFetch<{ success: boolean; uid: string }>("/api/user/subusers", {
        method: "POST",
        body: JSON.stringify({ 
          displayName, 
          username,
          email: email || undefined, 
          password: genPass, 
          phoneNumber: phoneNumber || undefined, 
          pin: genPin 
        }),
      });
      toast.success(`User created successfully`);
      
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
          <p className="text-sm text-on-surface-variant mb-6">Please copy the credentials below and securely share them with the user.</p>
          
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
            <button onClick={handleClose} className="flex-1 rounded-xl border border-outline-variant px-5 py-3 text-sm font-semibold text-on-surface hover:bg-surface-container transition-all">
              Done
            </button>
            <button onClick={handleCopy} className="flex-1 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white hover:opacity-90 transition-all shadow-lg shadow-primary/20">
              Copy All
            </button>
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
          <button type="button" onClick={handleClose} disabled={saving}
            className="rounded-xl p-2 text-on-surface-variant hover:bg-surface-container transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope">Full Name</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required
              className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-transparent transition-all"
              placeholder="e.g. Md. Rahim Uddin" />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope">Username</label>
              <input type="text" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} required
                className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-transparent transition-all"
                placeholder="Unique username" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope">Email <span className="text-outline font-normal normal-case tracking-normal">optional</span></label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-transparent transition-all"
                placeholder="user@example.com" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope">Phone <span className="text-outline font-normal normal-case tracking-normal">optional</span></label>
            <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-transparent transition-all"
              placeholder="+8801XXXXXXXXX" />
          </div>
          <div className="rounded-xl border border-primary/10 bg-primary/5 px-4 py-3 text-xs text-primary font-manrope font-medium">
            Password and 4-digit PIN will be auto-generated.
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={handleClose} disabled={saving}
              className="rounded-xl border border-outline-variant px-5 py-2.5 text-sm font-semibold text-on-surface hover:bg-surface-container disabled:opacity-50 transition-all">
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
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 sm:p-10 max-w-7xl mx-auto space-y-8 pb-12">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface mb-2">My Users</h1>
          <p className="text-on-surface-variant font-body text-lg">Manage accounts you have created.</p>
        </div>
        <button type="button" onClick={() => setRegisterOpen(true)}
          className="bg-primary text-on-primary px-6 py-3.5 rounded-xl font-bold font-manrope flex items-center gap-2 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
          <UserPlus className="h-5 w-5" />
          Create Sub-User
        </button>
      </section>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-11 pr-4 py-2.5 border border-outline-variant bg-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-transparent transition-all placeholder:text-on-surface-variant/60" />
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden premium-shadow">
        <div className="px-8 py-6 border-b border-black/[0.03] flex items-center justify-between">
          <h4 className="font-headline text-xl font-bold text-[#134235]">
            {loading ? "Loading..." : `${filteredUsers.length} User${filteredUsers.length !== 1 ? "s" : ""}`}
          </h4>
          <div className="flex items-center gap-2 text-on-surface-variant">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container/30">
                <th className="px-8 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope border-b border-black/[0.03]">User</th>
                <th className="px-8 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope border-b border-black/[0.03]">Status</th>
                <th className="px-8 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope border-b border-black/[0.03]">Wallet</th>
                <th className="px-8 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope border-b border-black/[0.03]">Joined</th>
                <th className="px-8 py-4 text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope border-b border-black/[0.03] text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.03]">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-on-surface-variant">
                    <div className="flex flex-col items-center justify-center gap-3">
                      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      <p className="font-medium text-sm">Loading users...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center">
                    <div className="flex flex-col items-center justify-center text-on-surface-variant space-y-3">
                      <div className="w-12 h-12 rounded-full bg-surface-container flex items-center justify-center mb-2">
                        <Users className="w-6 h-6 opacity-50" />
                      </div>
                      <p className="font-manrope font-bold text-lg text-on-surface">No users found</p>
                      <p className="text-sm">You haven't created any sub-users yet.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.uid} className="group hover:bg-surface-container/20 transition-colors">
                    <td className="px-8 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold font-manrope shadow-inner">
                          {getInitials(user.displayName)}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-on-surface font-manrope">{user.displayName}</p>
                          <p className="text-xs text-on-surface-variant">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-4">
                      <StatusBadge status={user.status} />
                    </td>
                    <td className="px-8 py-4">
                      <WalletAmount amount={user.walletBalance} />
                    </td>
                    <td className="px-8 py-4 text-sm text-on-surface-variant">
                      {relativeTime(user.createdAt as string)}
                    </td>
                    <td className="px-8 py-4 text-right">
                      <Link href={`/user/subusers/${user.uid}`}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold font-manrope text-primary bg-primary/5 hover:bg-primary/10 transition-colors">
                        Manage
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <RegisterSubUserDialog
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        onSuccess={refetch}
      />
    </div>
  );
}

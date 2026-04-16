"use client";
import { useState } from "react";
import { useUsers } from "@/lib/hooks/admin/useUsers";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { WalletAmount } from "@/components/admin/WalletAmount";
import { createUserAccount } from "@/lib/functions";
import { relativeTime, getInitials } from "@/lib/utils";
import { UserRole, UserStatus } from "@/types";
import Link from "next/link";
import { toast } from "sonner";
import { Search, UserPlus, X, Users, ArrowRight } from "lucide-react";

function RegisterUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const result = await createUserAccount({ displayName, email, password, phoneNumber: phoneNumber || undefined });
      toast.success(`User created (${result.uid.slice(0, 10)}...)`);
      setDisplayName(""); setEmail(""); setPassword(""); setPhoneNumber("");
      onClose();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to create user");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !saving && onClose()} />
      <div className="relative w-full max-w-lg rounded-2xl border border-black/5 bg-white p-8 premium-shadow">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-headline text-xl font-bold text-[#134235]">Register New User</h2>
            <p className="mt-1 text-sm text-on-surface-variant">Create a Firebase Auth account with dashboard profile.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving}
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
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required
                className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-transparent transition-all"
                placeholder="user@example.com" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope">Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
                className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-transparent transition-all"
                placeholder="Min. 6 characters" />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope">Phone <span className="text-outline font-normal normal-case tracking-normal">optional</span></label>
            <input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)}
              className="w-full rounded-xl border border-outline-variant bg-surface px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-transparent transition-all"
              placeholder="+8801XXXXXXXXX" />
          </div>
          <div className="rounded-xl border border-primary/10 bg-primary/5 px-4 py-3 text-xs text-primary font-manrope font-medium">
            New accounts start as regular users with ৳0 balance and active status.
          </div>
          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} disabled={saving}
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

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<UserRole | "all">("all");
  const [status, setStatus] = useState<UserStatus | "all">("all");
  const [registerOpen, setRegisterOpen] = useState(false);
  const { users, loading } = useUsers({ search, role, status });

  return (
    <div className="p-6 sm:p-10 max-w-7xl mx-auto space-y-8 pb-12">
      {/* Page header */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface mb-2">Users</h1>
          <p className="text-on-surface-variant font-body text-lg">Manage all registered accounts and access control.</p>
        </div>
        <button type="button" onClick={() => setRegisterOpen(true)}
          className="bg-primary text-on-primary px-6 py-3.5 rounded-xl font-bold font-manrope flex items-center gap-2 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
          <UserPlus className="h-5 w-5" />
          Register New User
        </button>
      </section>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full pl-11 pr-4 py-2.5 border border-outline-variant bg-white rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-transparent transition-all placeholder:text-on-surface-variant/60" />
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value as UserRole | "all")}
          className="border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-manrope font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white text-on-surface">
          <option value="all">All Roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as UserStatus | "all")}
          className="border border-outline-variant rounded-xl px-4 py-2.5 text-sm font-manrope font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white text-on-surface">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-black/5 overflow-hidden premium-shadow">
        <div className="px-8 py-6 border-b border-black/[0.03] flex items-center justify-between">
          <h4 className="font-headline text-xl font-bold text-[#134235]">
            {loading ? "Loading..." : `${users.length} Account${users.length !== 1 ? "s" : ""}`}
          </h4>
          <div className="flex items-center gap-2 text-on-surface-variant">
            <Users className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest font-manrope">Directory</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[640px]">
            <thead>
              <tr className="text-[11px] font-extrabold text-on-surface-variant/60 uppercase tracking-[0.2em] bg-surface-container/30 font-manrope">
                <th className="px-8 py-4">User</th>
                <th className="px-8 py-4">Role</th>
                <th className="px-8 py-4">Wallet</th>
                <th className="px-8 py-4">Status</th>
                <th className="px-8 py-4 hidden sm:table-cell">Last Login</th>
                <th className="px-8 py-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.03]">
              {loading && Array(5).fill(0).map((_, i) => (
                <tr key={i}>
                  <td colSpan={6} className="px-8 py-5">
                    <div className="h-4 bg-surface-container rounded-lg animate-pulse" />
                  </td>
                </tr>
              ))}
              {!loading && users.map((u) => (
                <tr key={u.uid} className="group hover:bg-surface-container/20 transition-colors">
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary text-sm font-bold flex items-center justify-center shrink-0 font-manrope">
                        {getInitials(u.displayName || u.email)}
                      </div>
                      <div>
                        <p className="font-bold text-on-surface font-manrope">{u.displayName}</p>
                        <p className="text-on-surface-variant text-xs">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-wider font-manrope ${
                      u.role === "admin" || u.role === "super_admin"
                        ? "bg-red-50 text-red-700"
                        : "bg-surface-container text-on-surface-variant"
                    }`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-8 py-5 font-bold text-[#134235] font-inter">
                    <WalletAmount amount={u.walletBalance} />
                  </td>
                  <td className="px-8 py-5"><StatusBadge status={u.status} /></td>
                  <td className="px-8 py-5 text-on-surface-variant text-sm hidden sm:table-cell">{relativeTime(u.lastLoginAt)}</td>
                  <td className="px-8 py-5">
                    <Link href={`/admin/users/${u.uid}`}
                      className="inline-flex items-center gap-1 text-primary text-xs font-bold font-manrope hover:underline">
                      View <ArrowRight className="w-3 h-3" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && users.length === 0 && (
          <p className="text-center text-on-surface-variant py-16 text-sm font-manrope">No users found</p>
        )}
      </div>

      <RegisterUserDialog open={registerOpen} onClose={() => setRegisterOpen(false)} />
    </div>
  );
}

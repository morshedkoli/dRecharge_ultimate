"use client";
import { useEffect, useState } from "react";
import { AppUser, UserRole } from "@/types";
import { setUserRole } from "@/lib/functions";
import { toast } from "sonner";
import { Search, Loader2, ShieldAlert, Shield, Users } from "lucide-react";

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchUid, setSearchUid] = useState("");
  const [isPromoting, setIsPromoting] = useState(false);

  useEffect(() => {
    let mounted = true;
    fetch("/api/admin/users")
      .then(r => r.json())
      .then(d => {
        if (!mounted || !d.users) return;
        const adminUsers = d.users.filter((u: AppUser) => ["admin", "super_admin", "support_admin"].includes(u.role));
        setAdmins(adminUsers);
        setLoading(false);
      })
      .catch(console.error);
    return () => { mounted = false; };
  }, []);

  async function handlePromoteUser(e: React.FormEvent) {
    e.preventDefault();
    if (!searchUid.trim()) return;
    setIsPromoting(true);
    try {
      await setUserRole(searchUid.trim(), "admin");
      toast.success("User successfully promoted to Admin");
      setSearchUid("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Failed to promote user");
    } finally { setIsPromoting(false); }
  }

  async function handleChangeRole(uid: string, newRole: UserRole) {
    try { await setUserRole(uid, newRole); toast.success("Role updated successfully"); }
    catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed to change role"); }
  }

  const roleConfig: Record<string, { bg: string; text: string; icon: typeof ShieldAlert }> = {
    super_admin:   { bg: "bg-red-50", text: "text-red-700", icon: ShieldAlert },
    admin:         { bg: "bg-[#E8F1EE]", text: "text-primary", icon: ShieldAlert },
    support_admin: { bg: "bg-amber-50", text: "text-amber-700", icon: Shield },
  };

  if (loading) {
    return (
      <div className="p-10 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-10 max-w-7xl mx-auto space-y-8 pb-12">
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface mb-2">Staff & Roles</h1>
          <p className="text-on-surface-variant font-body text-lg">Manage administrative access to the platform.</p>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Promote tool */}
        <div className="bg-white border border-black/5 rounded-2xl p-8 premium-shadow">
          <h2 className="font-headline font-bold text-[#134235] text-xl mb-2">Promote User</h2>
          <p className="text-xs text-on-surface-variant mb-5 font-manrope">Enter a user UID to grant admin access.</p>
          <form onSubmit={handlePromoteUser} className="relative">
            <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
            <input type="text" value={searchUid} onChange={(e) => setSearchUid(e.target.value)}
              placeholder="User UID…"
              className="w-full text-sm font-mono border border-outline-variant bg-surface rounded-xl pl-11 pr-24 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20" />
            <button type="submit" disabled={isPromoting}
              className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-primary hover:opacity-90 text-on-primary text-xs font-bold font-manrope rounded-lg disabled:opacity-50 transition-all">
              {isPromoting ? "Saving…" : "Promote"}
            </button>
          </form>
        </div>

        {/* Roles matrix */}
        <div className="bg-surface-container border border-black/5 rounded-2xl p-8 md:col-span-2 premium-shadow">
          <h3 className="font-headline font-bold text-[#134235] text-xl mb-5">Role Permissions</h3>
          <div className="space-y-4 text-sm">
            {[
              { role: "Super Admin", bg: "bg-red-50 text-red-700", desc: "Full unmitigated access to all dashboard functions." },
              { role: "Admin", bg: "bg-[#E8F1EE] text-primary", desc: "Full access. Shares identical permission level with Super Admin currently." },
              { role: "Support Admin", bg: "bg-amber-50 text-amber-700", desc: "Designed for viewing data and handling support tickets." },
            ].map((r) => (
              <div key={r.role} className="flex items-start gap-3">
                <span className={`px-3 py-1 rounded-full text-[10px] font-bold font-manrope uppercase tracking-wider shrink-0 ${r.bg}`}>{r.role}</span>
                <span className="text-on-surface-variant">{r.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Staff list */}
      <div className="bg-white border border-black/5 rounded-2xl overflow-hidden premium-shadow">
        <div className="px-8 py-6 border-b border-black/[0.03] flex items-center justify-between">
          <h2 className="font-headline font-bold text-[#134235] text-xl">
            Active Staff
            <span className="ml-2 text-base font-normal text-on-surface-variant">({admins.length})</span>
          </h2>
          <div className="flex items-center gap-2 text-on-surface-variant">
            <Shield className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-widest font-manrope">Staff Directory</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-[11px] font-extrabold text-on-surface-variant/60 uppercase tracking-[0.2em] bg-surface-container/30 font-manrope">
                <th className="px-8 py-4">User</th>
                <th className="px-8 py-4">Role</th>
                <th className="px-8 py-4 text-right">Change Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.03]">
              {admins.map((admin) => {
                const cfg = roleConfig[admin.role] || roleConfig.admin;
                const Icon = cfg.icon;
                return (
                  <tr key={admin.uid} className="group hover:bg-surface-container/20 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary text-sm font-bold flex items-center justify-center shrink-0 font-manrope">
                          {(admin.displayName || admin.email || "?").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-on-surface font-manrope">{admin.displayName || "Unknown"}</p>
                          <p className="text-xs text-on-surface-variant">{admin.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider font-manrope ${cfg.bg} ${cfg.text}`}>
                        <Icon className="w-3.5 h-3.5" />
                        {admin.role.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <select
                        className="text-xs border border-outline-variant rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white cursor-pointer font-manrope font-semibold text-on-surface"
                        value={admin.role}
                        onChange={(e) => {
                          const newRole = e.target.value as UserRole;
                          if (newRole === "user") {
                            if (window.confirm("Revoke this user's admin privileges?")) {
                              handleChangeRole(admin.uid, "user");
                            }
                          } else {
                            handleChangeRole(admin.uid, newRole);
                          }
                        }}>
                        <option disabled>Change Role</option>
                        <option value="super_admin">Super Admin</option>
                        <option value="admin">Admin</option>
                        <option value="support_admin">Support Admin</option>
                        <option value="user">Revoke Access</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
              {admins.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-8 py-16 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-surface-container mx-auto flex items-center justify-center mb-4">
                      <Users className="w-7 h-7 text-on-surface-variant" />
                    </div>
                    <p className="text-on-surface-variant text-sm font-manrope font-semibold">No admin accounts found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

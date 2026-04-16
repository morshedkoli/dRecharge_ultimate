"use client";
import { useEffect, useState, useCallback } from "react";
import { Service } from "@/types";
import { useProfile } from "@/lib/hooks/user/useProfile";
import { Wallet, Zap, Clock, ArrowRight, ShieldCheck, Plus, X } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { submitBalanceRequest } from "@/lib/functions";

export default function UserDashboardPage() {
  const { profile, loading: profileLoading } = useProfile();
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [addFundsOpen, setAddFundsOpen] = useState(false);
  const [addFundsAmount, setAddFundsAmount] = useState("");
  const [addFundsMedium, setAddFundsMedium] = useState("bKash");
  const [addFundsNote, setAddFundsNote] = useState("");
  const [addFundsLoading, setAddFundsLoading] = useState(false);

  async function handleAddFunds(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(addFundsAmount);
    if (!amount || amount <= 0) { toast.error("Please enter a valid amount."); return; }
    setAddFundsLoading(true);
    try {
      await submitBalanceRequest(amount, addFundsMedium, addFundsNote);
      toast.success("Balance request submitted. Waiting for admin approval.");
      setAddFundsOpen(false); setAddFundsAmount(""); setAddFundsMedium("bKash"); setAddFundsNote("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to submit request");
    } finally { setAddFundsLoading(false); }
  }

  const fetchServices = useCallback(async () => {
    try {
      const res = await fetch("/api/services", { credentials: "include" });
      const data = await res.json();
      const list: Service[] = data.services || [];
      list.sort((a, b) => a.name.localeCompare(b.name));
      setServices(list);
    } catch (err) {
      console.error("Services fetch error:", err);
    } finally {
      setLoadingServices(false);
    }
  }, []);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  if (profileLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-10 max-w-6xl mx-auto space-y-10 pb-12">
      {/* Welcome Banner */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="font-headline text-4xl font-extrabold tracking-tight text-on-surface mb-2">
            Welcome, {profile?.displayName?.split(" ")[0] || "User"}
          </h1>
          <p className="text-on-surface-variant font-body text-lg">Manage services, view your wallet, and track activity.</p>
        </div>
        <button onClick={() => setAddFundsOpen(true)}
          className="bg-primary text-on-primary px-6 py-3.5 rounded-xl font-bold font-manrope flex items-center gap-2 shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
          <Plus className="w-5 h-5" /> Add Funds
        </button>
      </section>

      {/* Wallet + Stats */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-black/5 rounded-2xl p-8 premium-shadow card-hover transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="p-3 bg-[#E8F1EE] rounded-xl">
              <Wallet className="w-6 h-6 text-primary" />
            </div>
            <span className="text-[11px] font-bold text-primary px-3 py-1 bg-primary/10 rounded-full tracking-tight font-manrope">Balance</span>
          </div>
          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-1 font-manrope">Available Balance</p>
          <h3 className="font-headline text-3xl font-extrabold text-[#134235]">৳{profile?.walletBalance?.toLocaleString() || "0"}</h3>
        </div>

        <div className="bg-white border border-black/5 rounded-2xl p-8 premium-shadow card-hover transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="p-3 bg-[#E8F1EE] rounded-xl">
              <ShieldCheck className="w-6 h-6 text-primary" />
            </div>
            <span className="text-[11px] font-bold text-primary px-3 py-1 bg-[#E8F1EE] rounded-full tracking-tight font-manrope uppercase">{profile?.status || "Active"}</span>
          </div>
          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-1 font-manrope">Account Status</p>
          <h3 className="font-headline text-3xl font-extrabold text-[#134235] capitalize">{profile?.status || "Active"}</h3>
        </div>

        <div className="bg-white border border-black/5 rounded-2xl p-8 premium-shadow card-hover transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="p-3 bg-surface-container rounded-xl">
              <Clock className="w-6 h-6 text-on-surface-variant" />
            </div>
            <span className="text-[11px] font-bold text-on-surface-variant px-3 py-1 bg-surface-container rounded-full tracking-tight font-manrope capitalize">{profile?.role || "User"}</span>
          </div>
          <p className="text-on-surface-variant text-xs font-bold uppercase tracking-widest mb-1 font-manrope">Account Role</p>
          <h3 className="font-headline text-3xl font-extrabold text-[#134235] capitalize">{profile?.role || "User"}</h3>
        </div>
      </section>

      {/* Services */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-headline text-2xl font-bold text-[#134235]">Available Services</h2>
            <p className="text-on-surface-variant text-sm mt-1">Select a service to send money or top up</p>
          </div>
          <Link href="/user/services" className="text-primary text-sm font-bold font-manrope hover:underline flex items-center gap-1">
            View All <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loadingServices ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="aspect-[3/4] bg-white rounded-2xl border border-black/5 animate-pulse" />
            ))}
          </div>
        ) : services.length === 0 ? (
          <div className="bg-white border border-black/5 rounded-2xl p-14 text-center premium-shadow">
            <div className="w-16 h-16 bg-surface-container rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Zap className="w-8 h-8 text-on-surface-variant" />
            </div>
            <p className="text-on-surface-variant text-sm font-manrope font-semibold">No services are currently active.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {services.map((svc) => (
              <Link key={svc.id} href={`/user/services/${svc.id}`}
                className="group relative bg-white border border-black/5 rounded-2xl overflow-hidden premium-shadow card-hover transition-all duration-200 aspect-[3/4] flex flex-col">
                {/* Full-bleed logo — fills entire card */}
                <div className="flex-1 relative overflow-hidden">
                  {svc.icon ? (
                    <img
                      src={svc.icon}
                      alt={svc.name}
                      className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-[#E8F1EE] to-[#C5DDD5] flex items-center justify-center">
                      <Zap className="w-12 h-12 text-primary/50 group-hover:text-primary transition-colors duration-200" />
                    </div>
                  )}
                </div>
                {/* Name strip — frosted glass bottom bar */}
                <div className="h-10 flex items-center justify-center px-2 bg-white border-t border-black/[0.05]">
                  <p className="font-manrope font-bold text-[#134235] text-[11px] text-center leading-tight group-hover:text-primary transition-colors line-clamp-1 w-full">{svc.name}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Add Funds Modal */}
      {addFundsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !addFundsLoading && setAddFundsOpen(false)} />
          <div className="relative bg-white rounded-2xl border border-black/5 premium-shadow w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-8 py-6 border-b border-black/[0.03]">
              <h2 className="font-headline text-xl font-bold text-[#134235]">Add Wallet Funds</h2>
              <button onClick={() => setAddFundsOpen(false)} disabled={addFundsLoading}
                className="p-2 text-on-surface-variant hover:bg-surface-container rounded-xl transition-colors disabled:opacity-50">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddFunds} className="p-8">
              <div className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-2">Amount (৳)</label>
                  <input type="number" required min="1" step="1"
                    value={addFundsAmount} onChange={(e) => setAddFundsAmount(e.target.value)}
                    placeholder="e.g. 500" disabled={addFundsLoading}
                    className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-2">Medium</label>
                  <select value={addFundsMedium} onChange={(e) => setAddFundsMedium(e.target.value)} disabled={addFundsLoading}
                    className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all">
                    <option value="bKash">bKash</option>
                    <option value="Nagad">Nagad</option>
                    <option value="Rocket">Rocket</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cash">Cash</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-2">Reference / Note <span className="text-outline font-normal normal-case tracking-normal">optional</span></label>
                  <input type="text"
                    value={addFundsNote} onChange={(e) => setAddFundsNote(e.target.value)}
                    placeholder="e.g. TrxID ABCD123" disabled={addFundsLoading}
                    className="w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all" />
                </div>
              </div>

              <div className="mt-8">
                <button type="submit" disabled={addFundsLoading || !addFundsAmount}
                  className="w-full bg-primary text-on-primary font-bold font-manrope py-3.5 rounded-xl hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center shadow-lg shadow-primary/20">
                  {addFundsLoading ? (
                    <><div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" /> Submitting...</>
                  ) : "Submit Request"}
                </button>
                <p className="text-xs text-center text-on-surface-variant mt-4 font-manrope">
                  Requests require administrator approval to reflect in your wallet.
                </p>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

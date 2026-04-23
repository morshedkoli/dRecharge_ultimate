"use client";
import { useEffect, useState, useCallback } from "react";
import { Service, ServiceCategory } from "@/types";
import { useProfile } from "@/lib/hooks/user/useProfile";
import { Wallet, Zap, ArrowRight, Plus, X, Tag, Megaphone } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { submitBalanceRequest } from "@/lib/functions";

export default function UserDashboardPage() {
  const { profile, loading: profileLoading } = useProfile();
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [noticeText, setNoticeText] = useState("");
  const [bannerUrls, setBannerUrls] = useState<string[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
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

  const fetchData = useCallback(async () => {
    try {
      const [catRes, svcRes, setRes] = await Promise.all([
        fetch("/api/categories", { credentials: "include" }),
        fetch("/api/services", { credentials: "include" }),
        fetch("/api/settings", { credentials: "include" }),
      ]);
      const [catData, svcData, setData] = await Promise.all([catRes.json(), svcRes.json(), setRes.json()]);
      setCategories(catData.categories || []);
      const list: Service[] = svcData.services || [];
      list.sort((a, b) => a.name.localeCompare(b.name));
      setServices(list);
      setNoticeText(setData.noticeText || "");
      setBannerUrls(setData.bannerUrls || []);
    } catch (err) {
      console.error("Dashboard data fetch error:", err);
    } finally {
      setLoadingServices(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-slide effect for banner carousel
  useEffect(() => {
    if (bannerUrls.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % bannerUrls.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [bannerUrls.length]);

  if (profileLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const getGroupedServices = () => {
    const grouped: Record<string, Service[]> = {};
    const uncategorized: Service[] = [];
    services.forEach((svc) => {
      if (svc.categoryId && categories.some(c => c.id === svc.categoryId)) {
        if (!grouped[svc.categoryId]) grouped[svc.categoryId] = [];
        grouped[svc.categoryId].push(svc);
      } else {
        uncategorized.push(svc);
      }
    });
    return { grouped, uncategorized };
  };

  const { grouped, uncategorized } = getGroupedServices();
  const activeCategories = categories.filter(cat => (grouped[cat.id] || []).length > 0);
  const currentCategory = categories.find(c => c.id === selectedCategoryId);
  const isUncategorizedSelected = selectedCategoryId === "uncategorized";

  const RenderServiceList = ({ svcList }: { svcList: Service[] }) => {
    if (svcList.length === 0) return null;
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-6">
        {svcList.map((svc) => (
          <Link key={svc.id} href={`/user/services/${svc.id}`}
            className="group relative bg-white border border-black/5 rounded-2xl overflow-hidden premium-shadow card-hover transition-all duration-200 aspect-[3/4] flex flex-col">
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
            <div className="h-10 flex items-center justify-center px-2 bg-white border-t border-black/[0.05]">
              <p className="font-manrope font-bold text-[#134235] text-[11px] text-center leading-tight group-hover:text-primary transition-colors line-clamp-1 w-full">{svc.name}</p>
            </div>
          </Link>
        ))}
      </div>
    );
  };

  return (
    <div className="p-6 sm:p-10 max-w-6xl mx-auto space-y-10 pb-12">
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee { display: inline-block; white-space: nowrap; animation: marquee 25s linear infinite; }
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />

      {/* Marquee Notice */}
      {noticeText && (
        <div className="overflow-hidden bg-[#E8F1EE] text-[#134235] border border-primary/20 py-2.5 px-4 rounded-xl flex items-center shadow-sm">
          <Megaphone className="w-5 h-5 shrink-0 mr-3 text-primary" />
          <div className="flex-1 overflow-hidden relative">
            <div className="animate-marquee font-manrope font-semibold text-sm tracking-wide">
              {noticeText}
            </div>
          </div>
        </div>
      )}
      
      {/* Banner Carousel */}
      {bannerUrls.length > 0 && (
        <section className="relative overflow-hidden rounded-2xl premium-shadow border border-black/5 aspect-[21/9] bg-surface-container">
          <div 
            className="flex transition-transform duration-700 ease-in-out h-full"
            style={{ transform: `translateX(-${currentSlide * 100}%)` }}
          >
            {bannerUrls.map((url, idx) => (
              <div key={idx} className="w-full shrink-0 h-full relative">
                <img src={url} alt={`Banner ${idx}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
          
          {/* Pagination dots */}
          {bannerUrls.length > 1 && (
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2 z-10">
              {bannerUrls.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-2 rounded-full transition-all ${
                    idx === currentSlide ? "bg-white w-6 opacity-100 shadow-[0_0_10px_rgba(0,0,0,0.5)]" : "bg-white/60 hover:bg-white/90 w-2 opacity-60 shadow-[0_0_4px_rgba(0,0,0,0.5)]"
                  }`}
                  aria-label={`Go to slide ${idx + 1}`}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Welcome Banner & Minimal Wallet */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white border border-black/5 rounded-2xl p-6 sm:p-8 premium-shadow">
        <div>
          <h1 className="font-headline text-3xl font-extrabold tracking-tight text-[#134235] mb-2">
            Welcome, {profile?.displayName?.split(" ")[0] || "User"}
          </h1>
          <p className="text-on-surface-variant font-body text-base">Select a service to send money or top up your account.</p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="bg-[#E8F1EE] px-5 py-3 rounded-xl border border-primary/20 flex flex-col justify-center min-w-[160px]">
            <p className="text-primary text-[10px] font-bold uppercase tracking-widest font-manrope mb-0.5">Available Balance</p>
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-primary" />
              <span className="font-headline text-2xl font-extrabold text-[#134235]">৳{profile?.walletBalance?.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2}) || "0.00"}</span>
            </div>
          </div>
          <button onClick={() => setAddFundsOpen(true)}
            className="bg-primary text-on-primary px-5 py-4 sm:py-3.5 rounded-xl font-bold font-manrope flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all">
            <Plus className="w-5 h-5" /> Add Funds
          </button>
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
              <div key={i} className="aspect-[5/4] bg-white rounded-2xl border border-black/5 animate-pulse" />
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
          <>
            {selectedCategoryId === null ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {activeCategories.map((cat) => {
                  const count = (grouped[cat.id] || []).length;
                  const isUrl = cat.logo?.startsWith("http://") || cat.logo?.startsWith("https://");
                  return (
                    <button key={cat.id} onClick={() => setSelectedCategoryId(cat.id)}
                      className="group relative bg-white border border-black/5 rounded-2xl overflow-hidden premium-shadow card-hover transition-all duration-200 aspect-[5/4] flex flex-col text-left">
                      <div className="flex-1 flex flex-col items-center justify-center p-4">
                        {cat.logo ? (
                          <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center overflow-hidden mb-3">
                             {isUrl ? (
                               <img src={cat.logo} alt={cat.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                             ) : (
                               <span className="text-2xl">{cat.logo}</span>
                             )}
                          </div>
                        ) : (
                          <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center mb-3">
                            <Tag className="w-6 h-6 text-on-surface-variant group-hover:text-primary transition-colors" />
                          </div>
                        )}
                        <h3 className="font-headline font-bold text-[#134235] text-sm text-center leading-tight group-hover:text-primary transition-colors">{cat.name}</h3>
                        <p className="text-xs text-on-surface-variant mt-1">{count} service{count !== 1 ? 's' : ''}</p>
                      </div>
                    </button>
                  );
                })}
                {uncategorized.length > 0 && (
                  <button onClick={() => setSelectedCategoryId("uncategorized")}
                    className="group relative bg-white border border-black/5 rounded-2xl overflow-hidden premium-shadow card-hover transition-all duration-200 aspect-[5/4] flex flex-col text-left">
                    <div className="flex-1 flex flex-col items-center justify-center p-4">
                      <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center mb-3">
                        <Zap className="w-6 h-6 text-on-surface-variant group-hover:text-primary transition-colors" />
                      </div>
                      <h3 className="font-headline font-bold text-[#134235] text-sm text-center leading-tight group-hover:text-primary transition-colors">Uncategorized</h3>
                      <p className="text-xs text-on-surface-variant mt-1">{uncategorized.length} service{uncategorized.length !== 1 ? 's' : ''}</p>
                    </div>
                  </button>
                )}
              </div>
            ) : (
              <div>
                <button 
                  onClick={() => setSelectedCategoryId(null)}
                  className="flex items-center gap-2 text-sm font-semibold text-primary mb-6 hover:text-primary/80 transition-colors"
                 >
                  <span>&larr;</span> Back to Categories
                </button>
                <div className="flex items-center gap-3 mb-5 pb-3 border-b border-outline-variant/30">
                  {isUncategorizedSelected ? (
                    <>
                      <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center">
                        <Zap className="w-5 h-5 text-on-surface-variant" />
                      </div>
                      <h2 className="font-headline text-2xl font-bold text-[#134235]">Uncategorized Services</h2>
                    </>
                  ) : currentCategory && (
                    <>
                      {currentCategory.logo ? (
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                          {currentCategory.logo.startsWith("http") ? (
                            <img src={currentCategory.logo} alt={currentCategory.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-lg">{currentCategory.logo}</span>
                          )}
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-surface-container flex items-center justify-center">
                          <Tag className="w-5 h-5 text-on-surface-variant" />
                        </div>
                      )}
                      <h2 className="font-headline text-2xl font-bold text-[#134235]">{currentCategory.name}</h2>
                    </>
                  )}
                </div>
                {isUncategorizedSelected ? (
                  <RenderServiceList svcList={uncategorized} />
                ) : currentCategory ? (
                  <RenderServiceList svcList={grouped[currentCategory.id] || []} />
                ) : null}
              </div>
            )}
          </>
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

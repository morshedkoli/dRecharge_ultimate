"use client";
import { use, useEffect, useState, useCallback } from "react";
import { Service } from "@/types";
import { useProfile } from "@/lib/hooks/user/useProfile";
import { useModalEffect } from "@/lib/hooks/useModalEffect";
import { initiateTransaction } from "@/lib/functions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { ArrowLeft, Zap, Phone, DollarSign, Send, Info, X, Lock, Loader2, Wallet } from "lucide-react";
import Link from "next/link";

export default function ServiceExecutionPage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = use(params);
  const router = useRouter();
  const { profile } = useProfile();
  
  const [service, setService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [recipient, setRecipient] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Pin Modal states
  const [previewOpen, setPreviewOpen] = useState(false);
  const containerRef = useModalEffect(previewOpen);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  const fetchService = useCallback(async () => {
    try {
      const res = await fetch(`/api/services/${serviceId}`, { credentials: "include" });
      if (res.status === 404) {
        setError("Service not found or no longer active.");
        return;
      }
      const data = await res.json();
      const svc = data.service as Service;
      if (!svc?.isActive) {
        setError("This service is currently disabled by the administrator.");
      }
      setService(svc);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load service");
    } finally {
      setLoading(false);
    }
  }, [serviceId]);

  useEffect(() => { fetchService(); }, [fetchService]);

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-black/5 border-t-primary" />
      </div>
    );
  }

  if (error || !service) {
    return (
      <div className="max-w-2xl mx-auto p-10 text-center bg-white rounded-3xl premium-shadow border border-red-100">
        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-5">
           <X className="w-8 h-8" />
        </div>
        <p className="text-red-600 font-bold font-manrope text-lg mb-6">{error || "Service unavailable"}</p>
        <Link href="/user/services" className="inline-flex items-center text-sm font-bold text-primary hover:text-primary-dim bg-[#E8F1EE] px-6 py-3 rounded-xl transition-colors font-manrope">
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to Services
        </Link>
      </div>
    );
  }

  const balance = profile?.walletBalance || 0;
  const amount = parseFloat(amountStr) || 0;
  const isOverBalance = amount > balance;
  const requiredRecipientLength = service.recipientLength || 11;
  const isValid = recipient.length === requiredRecipientLength && amount > 0 && !isOverBalance;
  const effectivePin = profile?.pin?.trim() || "1234";
  const requiredPinLength = effectivePin.length;

  function handleFormSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;
    setPinInput("");
    setPinError("");
    setPreviewOpen(true);
  }

  async function handleConfirmTransaction(e: React.FormEvent) {
    e.preventDefault();
    setPinError("");

    if (pinInput.length !== requiredPinLength) {
      setPinError(`PIN must be ${requiredPinLength} digits.`);
      return;
    }

    if (pinInput !== effectivePin) {
      setPinError("Invalid PIN entered. Please try again.");
      return;
    }

    setSubmitting(true);
    try {
      await initiateTransaction({
        serviceId,
        recipientNumber: recipient.trim(),
        amount: amount,
      });
      toast.success("Transaction requested successfully!");
      setPreviewOpen(false);
      router.push("/user/history");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to execute transaction");
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto pb-12">
      {/* Header */}
      <div className="mb-8">
        <Link href="/user/services" className="inline-flex items-center text-sm font-bold font-manrope text-on-surface-variant hover:text-[#134235] mb-6 transition-colors group">
          <div className="w-8 h-8 rounded-full bg-white border border-black/5 flex items-center justify-center mr-3 group-hover:shadow-sm transition-all">
            <ArrowLeft className="w-4 h-4" />
          </div>
          Back to Directory
        </Link>
        
        <div className="flex flex-col sm:flex-row sm:items-center gap-5 bg-white p-6 rounded-3xl border border-black/5 premium-shadow">
          <div className="w-20 h-20 rounded-2xl bg-[#E8F1EE] flex items-center justify-center border border-primary/10 shrink-0 overflow-hidden">
            {service.icon ? (
               <img src={service.icon} alt={service.name} className="w-full h-full object-cover" />
            ) : (
               <Zap className="w-8 h-8 text-primary" />
            )}
          </div>
          <div className="pt-1">
            <h1 className="text-3xl font-extrabold text-[#134235] mb-2 font-headline tracking-tight">{service.name}</h1>
            <p className="text-sm text-on-surface-variant font-medium leading-relaxed max-w-xl">{service.description || "Send money seamlessly to the recipient with FinPay instant execution."}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {/* Form Column */}
        <div className="md:col-span-3">
          <div className="bg-white rounded-3xl border border-black/5 premium-shadow p-6 sm:p-8">
            <h2 className="text-xl font-bold text-[#134235] mb-6 font-manrope flex items-center gap-2">
               <span className="w-1.5 h-6 bg-primary rounded-full"></span>
               Execution Details
            </h2>
            
            <form onSubmit={handleFormSubmit} className="space-y-6">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-2">Recipient Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant/50" />
                  <input 
                    type="text" 
                    value={recipient} 
                    onChange={(e) => setRecipient(e.target.value)} 
                    required
                    placeholder="e.g. 01700000000"
                    disabled={submitting}
                    className="w-full pl-12 pr-4 py-3.5 bg-surface-container border border-black/5 rounded-2xl text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all placeholder:text-on-surface-variant/40" 
                  />
                </div>
                {recipient.length > 0 && recipient.length !== requiredRecipientLength && (
                  <p className="text-amber-600 text-xs mt-2 flex items-center font-bold font-manrope">
                    <Info className="w-3.5 h-3.5 mr-1" />
                    Number must be exactly {requiredRecipientLength} digits.
                  </p>
                )}
              </div>
              
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-2">Amount to Send (৳)</label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-on-surface-variant/50" />
                  <input 
                    type="number" 
                    min="1" 
                    step="1"
                    value={amountStr} 
                    onChange={(e) => setAmountStr(e.target.value)} 
                    required
                    placeholder="0.00"
                    disabled={submitting}
                    className="w-full pl-12 pr-4 py-3.5 bg-surface-container border border-black/5 rounded-2xl text-[15px] font-bold text-on-surface focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all placeholder:text-on-surface-variant/40" 
                  />
                </div>
                {isOverBalance && (
                  <p className="text-red-500 text-xs mt-2 flex items-center font-bold font-manrope">
                    <Info className="w-3.5 h-3.5 mr-1 text-red-400" />
                    Amount exceeds available balance.
                  </p>
                )}
              </div>

              <div className="pt-6">
                <button 
                  type="submit" 
                  disabled={!isValid || submitting}
                  className="w-full flex items-center justify-center gap-2 bg-primary text-white py-4 rounded-2xl font-bold font-manrope text-lg hover:bg-primary-dim disabled:opacity-50 disabled:hover:bg-primary transition-all shadow-md active:scale-[0.98]"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin text-white/70" />
                      Processing…
                    </>
                  ) : (
                    <>
                      Proceed with Transaction <Send className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Info Column */}
        <div className="md:col-span-2 space-y-6">
          <div className="bg-gradient-to-br from-[#134235] to-primary rounded-3xl p-8 text-white premium-shadow relative overflow-hidden">
            <div className="relative z-10 flex flex-col h-full justify-center">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/10 border border-white/10 text-[10px] font-bold font-manrope mb-4 uppercase tracking-widest backdrop-blur-md w-fit">
                 <Wallet className="w-3.5 h-3.5 text-emerald-300" /> Wallet Balance
              </div>
              <p className="text-4xl font-extrabold mb-1 font-headline flex items-baseline tracking-tight">
                <span className="text-xl mr-1 font-bold text-[#A2C2B5]">৳</span>
                {balance.toLocaleString()}
              </p>
            </div>
            {/* Decoration */}
            <div className="absolute right-0 bottom-0 w-48 h-48 bg-white/5 rounded-full blur-2xl translate-y-1/3 translate-x-1/4 pointer-events-none" />
          </div>

          <div className="bg-white border border-black/5 rounded-3xl p-6 premium-shadow">
            <h3 className="text-sm font-bold text-[#134235] mb-4 flex items-center gap-2 font-manrope">
              <Info className="w-4 h-4 text-primary" /> Important Note
            </h3>
            <ul className="text-xs text-on-surface-variant space-y-3 list-disc pl-4 leading-relaxed marker:text-black/10">
              <li>Transactions are processed via backend queueing and complete within seconds.</li>
              <li>Ensure the recipient number is completely accurate before confirming.</li>
              <li>Your wallet balance will be deducted immediately, but automatically refunded if the transaction fails.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Transaction Preview & PIN Modal */}
      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !submitting && setPreviewOpen(false)} />
          <div ref={containerRef} className="relative bg-white rounded-3xl premium-shadow w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-black/5">
            <div className="flex items-center justify-between px-6 py-5 border-b border-black/[0.04]">
              <div className="flex items-center gap-3">
                 <div className="p-2.5 bg-[#E8F1EE] rounded-xl text-primary"><Lock className="w-5 h-5"/></div>
                 <h2 className="text-lg font-bold text-[#134235] font-manrope">Confirm Action</h2>
              </div>
              <button 
                onClick={() => setPreviewOpen(false)} 
                disabled={submitting} 
                className="p-2 -mr-2 text-on-surface-variant hover:bg-surface-container rounded-full transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleConfirmTransaction} className="p-6">
              <div className="space-y-4 mb-8 text-sm text-on-surface-variant">
                <div className="flex justify-between items-center border-b border-dashed border-black/10 pb-3">
                  <span className="font-semibold">Service</span>
                  <span className="font-bold text-[#134235]">{service.name}</span>
                </div>
                <div className="flex justify-between items-center border-b border-dashed border-black/10 pb-3">
                  <span className="font-semibold">Recipient</span>
                  <span className="font-mono font-bold text-primary px-2 bg-primary/5 rounded">{recipient}</span>
                </div>
                <div className="flex justify-between items-center border-black/10 pb-1">
                  <span className="font-semibold">Amount</span>
                  <span className="font-extrabold text-[#134235] text-lg">৳{amount.toLocaleString()}</span>
                </div>
              </div>

              <div className="mb-8">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-on-surface-variant font-manrope mb-2 text-center">Confirm with your PIN</label>
                <div className="relative max-w-[200px] mx-auto">
                  <input 
                    type="password" 
                    required 
                    inputMode="numeric"
                    maxLength={requiredPinLength}
                    value={pinInput} 
                    onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))} 
                    placeholder="••••" 
                    disabled={submitting}
                    className="w-full py-4 bg-surface-container border border-black/5 rounded-2xl text-2xl tracking-[0.5em] font-extrabold focus:outline-none focus:ring-2 focus:ring-primary focus:bg-white transition-all text-center text-[#134235] placeholder:text-black/10" 
                  />
                </div>
                {pinError && <p className="text-red-500 text-xs font-bold mt-3 text-center flex items-center justify-center gap-1 font-manrope"><Info className="w-3.5 h-3.5" />{pinError}</p>}
                {!profile?.pin && !pinError && <p className="text-on-surface-variant/60 text-[10px] mt-3 text-center font-bold uppercase tracking-wider">Default unconfigured PIN is 1234</p>}
                {!!profile?.pin && !pinError && <p className="text-on-surface-variant/60 text-[10px] mt-3 text-center font-bold uppercase tracking-wider">Enter your {requiredPinLength}-digit transaction PIN</p>}
              </div>

              <div>
                <button 
                  type="submit" 
                  disabled={submitting || pinInput.length !== requiredPinLength}
                  className="w-full bg-primary text-white font-bold font-manrope py-4 rounded-2xl hover:bg-primary-dim active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center premium-shadow"
                >
                  {submitting ? (
                    <><Loader2 className="w-5 h-5 animate-spin mr-2 text-white/70" /> Executing…</>
                  ) : "Confirm & Execute"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

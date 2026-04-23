"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Save, Plus, Trash2, Megaphone, Image as ImageIcon } from "lucide-react";
import { ImageUpload } from "@/components/admin/ImageUpload";

export default function AdminNoticePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Settings state variables
  const [domain, setDomain] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [noticeText, setNoticeText] = useState("");
  const [isNoticeEnabled, setIsNoticeEnabled] = useState(true);
  const [isEditingNoticeText, setIsEditingNoticeText] = useState(false);
  const [bannerUrls, setBannerUrls] = useState<string[]>([]);
  
  // Input for adding new banner
  const [newBannerUrl, setNewBannerUrl] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const res = await fetch("/api/admin/settings");
      if (!res.ok) throw new Error("Failed to fetch settings");
      const data = await res.json();
      setDomain(data.domain || "");
      setPhoneNumber(data.phoneNumber || "");
      setNoticeText(data.noticeText || "");
      setIsNoticeEnabled(data.isNoticeEnabled ?? true);
      setBannerUrls(Array.isArray(data.bannerUrls) ? data.bannerUrls : []);
    } catch (err) {
      console.error(err);
      toast.error("Could not load notice settings.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = {
        domain,
        phoneNumber,
        noticeText,
        isNoticeEnabled,
        bannerUrls
      };

      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to save settings");
      }

      toast.success("Notice settings saved successfully!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  }

  function handleAddBanner() {
    const url = newBannerUrl.trim();
    if (!url) return;
    if (!url.startsWith("http")) {
      toast.error("Please enter a valid HTTP(S) URL.");
      return;
    }
    setBannerUrls([...bannerUrls, url]);
    setNewBannerUrl("");
  }

  function handleRemoveBanner(indexToRemove: number) {
    setBannerUrls(bannerUrls.filter((_, idx) => idx !== indexToRemove));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl space-y-8 pb-12">
      <div>
        <h1 className="font-headline text-3xl font-extrabold text-[#134235] mb-2">Notice Board</h1>
        <p className="text-on-surface-variant">Manage the scrolling text notice and promotional banner images for the user dashboard.</p>
      </div>

      <div className="bg-white border text-left border-black/[0.05] rounded-2xl p-6 md:p-8 premium-shadow space-y-8">
        
        {/* -- Text Notice -- */}
        <section className="space-y-4">
          <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-3">
             <div className="p-2 bg-primary/10 rounded-xl">
               <Megaphone className="w-5 h-5 text-primary" />
             </div>
             <h2 className="font-headline text-xl font-bold text-[#134235]">Scrolling Text Notice</h2>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <label className="text-xs font-bold uppercase tracking-widest text-on-surface-variant font-manrope">Notice Text</label>
                <button 
                  onClick={() => setIsEditingNoticeText(!isEditingNoticeText)}
                  className="text-primary text-xs font-bold hover:underline transition-colors flex items-center gap-1"
                >
                  {isEditingNoticeText ? "Lock" : "Edit"}
                </button>
              </div>
              <label className="flex items-center gap-2 cursor-pointer group">
                <span className={`text-xs font-bold font-manrope transition-colors ${isNoticeEnabled ? "text-primary" : "text-on-surface-variant"}`}>
                  {isNoticeEnabled ? "Enabled" : "Disabled"}
                </span>
                <div className={`relative w-10 h-5 rounded-full transition-colors ${isNoticeEnabled ? "bg-primary" : "bg-surface-container border border-outline-variant"}`}>
                  <input type="checkbox" className="sr-only" checked={isNoticeEnabled} onChange={(e) => setIsNoticeEnabled(e.target.checked)} />
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full transition-transform ${isNoticeEnabled ? "translate-x-5 bg-white" : "translate-x-0 bg-on-surface-variant group-hover:bg-on-surface"}`} />
                </div>
              </label>
            </div>
            <textarea
              rows={3}
              value={noticeText}
              disabled={!isNoticeEnabled}
              readOnly={!isEditingNoticeText}
              onChange={(e) => setNoticeText(e.target.value)}
              placeholder="Enter the notice that will scroll at the top of the user dashboard (e.g. Server maintenance scheduled for 10 PM. Please complete your tasks...)"
              className={`w-full px-4 py-3 bg-surface border border-outline-variant rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all font-body text-on-surface resize-none ${!isNoticeEnabled ? "opacity-50 bg-surface-container cursor-not-allowed" : ""} ${!isEditingNoticeText && isNoticeEnabled ? "bg-surface-container/30 border-dashed outline-none" : ""}`}
            />
            <p className="text-xs text-on-surface-variant mt-2">Toggle to show or hide the scrolling text on the user dashboard.</p>
          </div>
        </section>

        {/* -- Banners -- */}
        <section className="space-y-4 pt-4">
          <div className="flex items-center gap-3 border-b border-outline-variant/30 pb-3">
             <div className="p-2 bg-primary/10 rounded-xl">
               <ImageIcon className="w-5 h-5 text-primary" />
             </div>
             <h2 className="font-headline text-xl font-bold text-[#134235]">Banner Slider Images</h2>
          </div>
          
          <div className="space-y-4">
            {/* Added Banners List */}
            {bannerUrls.length > 0 ? (
              <div className="space-y-3">
                {bannerUrls.map((url, idx) => (
                  <div key={idx} className="flex items-center gap-4 bg-surface-container rounded-xl p-3 border border-outline-variant">
                    <img src={url} alt={`Banner ${idx + 1}`} className="w-24 h-12 object-cover rounded-md bg-white shrink-0 shadow-sm" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-on-surface-variant truncate">{url}</p>
                    </div>
                    <button 
                      onClick={() => handleRemoveBanner(idx)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                      title="Remove Banner"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant italic">No banners added yet.</p>
            )}

            {/* Add New Banner Form */}
            <div className="mt-6 bg-surface p-4 rounded-xl border border-outline-variant/50">
              <ImageUpload
                value={newBannerUrl}
                onChange={setNewBannerUrl}
                label="Add New Banner"
                hint="Upload an image or paste URL"
              />
              <div className="mt-4 flex justify-end">
                <button 
                  onClick={handleAddBanner}
                  disabled={!newBannerUrl.trim()}
                  className="bg-[#E8F1EE] text-[#134235] px-6 py-2.5 rounded-xl font-bold font-manrope flex items-center gap-2 hover:bg-primary/20 transition-colors disabled:opacity-50 disabled:pointer-events-none"
                >
                  <Plus className="w-4 h-4" /> Add to Slider
                </button>
              </div>
            </div>
            <p className="text-xs text-on-surface-variant mt-2">Added banners will automatically display in a swipeable slider on the user dashboard. Best resolution: 16:9 ratio.</p>
          </div>
        </section>

        {/* -- Save -- */}
        <div className="pt-6 flex justify-end">
          <button 
            onClick={handleSave} 
            disabled={saving}
            className="bg-primary text-on-primary px-8 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100"
          >
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" /> Saving...</>
            ) : (
              <><Save className="w-4 h-4" /> Save Changes</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

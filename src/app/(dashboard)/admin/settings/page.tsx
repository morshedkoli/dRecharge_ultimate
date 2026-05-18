"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useAdminSettings } from "@/lib/hooks/admin/useAdminSettings";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  Loader2, Save, Plus, Trash2, Upload,
  ShieldAlert, ScrollText, Bell, UserCircle, ArrowRight,
  Palette, Settings as SettingsIcon, Megaphone, Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ADMIN_SHORTCUTS = [
  { href: "/admin/logs",    label: "Audit Logs",  description: "Security & action history",   icon: ShieldAlert },
  { href: "/admin/logs",    label: "System Logs", description: "Application event stream",     icon: ScrollText },
  { href: "/admin/notice",  label: "Notices",     description: "Push announcements to users",  icon: Bell },
  { href: "/admin/profile", label: "Profile",     description: "Your admin account",           icon: UserCircle },
];

type TabKey = "branding" | "general" | "notice" | "banners";

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "branding", label: "Branding",  icon: Palette },
  { key: "general",  label: "General",   icon: SettingsIcon },
  { key: "notice",   label: "Notice",    icon: Megaphone },
  { key: "banners",  label: "Banners",   icon: ImageIcon },
];

export default function AdminSettingsPage() {
  const { settings, loading, updateSettings } = useAdminSettings();
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("branding");

  // Form State
  const [appName, setAppName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [domain, setDomain] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [noticeText, setNoticeText] = useState("");
  const [isNoticeEnabled, setIsNoticeEnabled] = useState(true);
  const [bannerUrls, setBannerUrls] = useState<string[]>([]);

  useEffect(() => {
    if (settings) {
      setAppName(settings.appName || "PayChat");
      setLogoUrl(settings.logoUrl || "/logo.png");
      setPrimaryColor(settings.primaryColor || "#134235");
      setDomain(settings.domain || "");
      setPhoneNumber(settings.phoneNumber || "");
      setNoticeText(settings.noticeText || "");
      setIsNoticeEnabled(settings.isNoticeEnabled ?? true);
      setBannerUrls(settings.bannerUrls || []);
    }
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    const success = await updateSettings({
      appName,
      logoUrl,
      primaryColor,
      domain,
      phoneNumber,
      noticeText,
      isNoticeEnabled,
      bannerUrls,
    });
    setSaving(false);
    if (success) {
      toast.success("Settings updated successfully!");
      setTimeout(() => window.location.reload(), 500);
    } else {
      toast.error("Failed to update settings.");
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingLogo(true);
      const formData = new FormData();
      formData.append("image", file);
      formData.append("name", "brand_logo_" + Date.now());

      const res = await fetch("/api/admin/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Failed to upload image");

      const data = await res.json();
      if (data.url) {
        setLogoUrl(data.url);
        toast.success("Logo uploaded successfully!");
      } else {
        throw new Error("No URL returned from upload");
      }
    } catch (error) {
      toast.error("Logo upload failed.");
      console.error(error);
    } finally {
      setUploadingLogo(false);
      e.target.value = "";
    }
  };

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-[#134235]">Platform Settings</h1>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </div>

      {/* TOOLS & SHORTCUTS — top of page */}
      <Card>
        <CardHeader>
          <CardTitle>Tools & Shortcuts</CardTitle>
          <CardDescription>Audit history, system logs, notices, and your admin profile.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {ADMIN_SHORTCUTS.map((s) => (
              <Link key={s.label} href={s.href}
                className="group flex items-center gap-3 p-3 rounded-xl bg-white border border-black/5 hover:border-primary/30 hover:shadow-sm transition-all">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary transition-colors">
                  <s.icon className="w-4.5 h-4.5 text-primary group-hover:text-on-primary transition-colors" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-on-surface font-manrope leading-tight truncate">{s.label}</p>
                  <p className="text-[11px] text-on-surface-variant truncate">{s.description}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-on-surface-variant group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* TAB BAR */}
      <div className="border-b border-outline-variant/40">
        <div className="flex gap-1 overflow-x-auto -mx-1 px-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = activeTab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold font-manrope whitespace-nowrap border-b-2 -mb-px transition-all",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-on-surface-variant hover:text-on-surface hover:border-outline-variant"
                )}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── BRANDING TAB ───────────────────────────────────────────── */}
      {activeTab === "branding" && (
        <Card>
          <CardHeader>
            <CardTitle>Branding & Appearance</CardTitle>
            <CardDescription>Customize the look and feel of the platform.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">App Name</label>
              <Input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="PayChat" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Primary Color (Hex)</label>
              <div className="flex gap-2">
                <Input type="color" className="w-14 h-10 p-1 cursor-pointer" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                <Input className="flex-1 font-mono uppercase" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#134235" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Logo URL</label>
              <div className="flex gap-2">
                <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://i.ibb.co/..." />
                <div className="relative overflow-hidden shrink-0">
                  <Button variant="outline" type="button" disabled={uploadingLogo} className="w-[110px]">
                    {uploadingLogo ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Upload
                  </Button>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                    disabled={uploadingLogo}
                  />
                </div>
              </div>
              {logoUrl && (
                <div className="mt-2 rounded border bg-surface-container/30 p-2 flex justify-center">
                  <img src={logoUrl} alt="Logo Preview" className="h-10 object-contain" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── GENERAL TAB ────────────────────────────────────────────── */}
      {activeTab === "general" && (
        <Card>
          <CardHeader>
            <CardTitle>General Configuration</CardTitle>
            <CardDescription>Core system settings and contact info.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">API Domain</label>
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="api.example.com" />
              <p className="text-xs text-on-surface-variant/70">The domain used by agents to connect to this server.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Support Phone Number</label>
              <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+8801700000000" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── NOTICE TAB ─────────────────────────────────────────────── */}
      {activeTab === "notice" && (
        <Card>
          <CardHeader>
            <CardTitle>Notice Board</CardTitle>
            <CardDescription>Manage the scrolling notice for users.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <label className="text-sm font-medium">Enable Notice Board</label>
                <div className="text-xs text-on-surface-variant/70">Show the scrolling text to all users.</div>
              </div>
              <input type="checkbox" className="h-5 w-5 accent-primary cursor-pointer" checked={isNoticeEnabled} onChange={(e) => setIsNoticeEnabled(e.target.checked)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Notice Text</label>
              <Input value={noticeText} onChange={(e) => setNoticeText(e.target.value)} placeholder="Welcome to our platform!" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── BANNERS TAB ────────────────────────────────────────────── */}
      {activeTab === "banners" && (
        <Card>
          <CardHeader>
            <CardTitle>Promotional Banners</CardTitle>
            <CardDescription>Manage the images displayed in the user dashboard carousel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {bannerUrls.length === 0 && (
              <p className="text-sm text-on-surface-variant text-center py-4">
                No banners yet — add one below.
              </p>
            )}
            {bannerUrls.map((url, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Input
                  value={url}
                  onChange={(e) => {
                    const newUrls = [...bannerUrls];
                    newUrls[idx] = e.target.value;
                    setBannerUrls(newUrls);
                  }}
                  placeholder="https://i.ibb.co/..."
                />
                <Button variant="ghost" size="icon" onClick={() => setBannerUrls(bannerUrls.filter((_, i) => i !== idx))} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" className="w-full" onClick={() => setBannerUrls([...bannerUrls, ""])}>
              <Plus className="mr-2 h-4 w-4" /> Add Banner
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

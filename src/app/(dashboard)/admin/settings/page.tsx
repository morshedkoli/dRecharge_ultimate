"use client";
import { useState, useEffect } from "react";
import { useAdminSettings } from "@/lib/hooks/admin/useAdminSettings";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Loader2, Save, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";

export default function AdminSettingsPage() {
  const { settings, loading, updateSettings } = useAdminSettings();
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);

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
      // Reload the page to forcefully re-fetch the RootLayout server components
      // and apply the new CSS variable primary color and branding immediately.
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

      if (!res.ok) {
        throw new Error("Failed to upload image");
      }

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-[#134235]">Platform Settings</h1>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save Changes
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* BRANDING */}
        <Card>
          <CardHeader>
            <CardTitle>Branding & Appearance</CardTitle>
            <CardDescription>Customize the look and feel of the platform.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">App Name</label>
              <Input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="PayChat" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Primary Color (Hex)</label>
              <div className="flex gap-2">
                <Input type="color" className="w-14 h-10 p-1 cursor-pointer" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} />
                <Input className="flex-1 font-mono uppercase" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#134235" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Logo URL</label>
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

        {/* GENERAL CONFIG */}
        <Card>
          <CardHeader>
            <CardTitle>General Configuration</CardTitle>
            <CardDescription>Core system settings and contact info.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">API Domain</label>
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="api.example.com" />
              <p className="text-xs text-on-surface-variant/70">The domain used by agents to connect to this server.</p>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Support Phone Number</label>
              <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+8801700000000" />
            </div>
          </CardContent>
        </Card>

        {/* NOTICE BOARD */}
        <Card>
          <CardHeader>
            <CardTitle>Notice Board</CardTitle>
            <CardDescription>Manage the scrolling notice for users.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Enable Notice Board</label>
                <div className="text-xs text-on-surface-variant/70">Show the scrolling text to all users.</div>
              </div>
              <input type="checkbox" className="h-5 w-5 accent-primary cursor-pointer" checked={isNoticeEnabled} onChange={(e) => setIsNoticeEnabled(e.target.checked)} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Notice Text</label>
              <Input value={noticeText} onChange={(e) => setNoticeText(e.target.value)} placeholder="Welcome to our platform!" />
            </div>
          </CardContent>
        </Card>

        {/* BANNERS */}
        <Card>
          <CardHeader>
            <CardTitle>Promotional Banners</CardTitle>
            <CardDescription>Manage the images displayed in the user dashboard carousel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
      </div>
    </div>
  );
}

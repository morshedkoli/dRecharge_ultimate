"use client";
import { useState } from "react";
import { useAuth } from "@/lib/hooks/useAuth";
import { useProfile } from "@/lib/hooks/user/useProfile";
import { toast } from "sonner";
import { User, Lock, KeyRound, Save, Mail, Phone, Info, AtSign, CreditCard } from "lucide-react";

export default function UserProfilePage() {
  const { user } = useAuth();
  const { profile, loading: profileLoading, refetch } = useProfile();

  // Password State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Username State
  const [newUsername, setNewUsername] = useState("");
  const [usernameLoading, setUsernameLoading] = useState(false);

  // PIN State
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinLoading, setPinLoading] = useState(false);

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match!");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    
    setPasswordLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "changePassword", currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update password");
      toast.success("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update password");
    } finally {
      setPasswordLoading(false);
    }
  }

  async function handleUsernameChange(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!/^[a-z0-9_]{3,20}$/.test(newUsername)) {
      toast.error("Username must be 3–20 chars: letters, numbers, underscores only");
      return;
    }
    setUsernameLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "changeUsername", username: newUsername }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update username");
      toast.success("Username updated! You can now login with it.");
      setNewUsername("");
      await refetch();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update username");
    } finally {
      setUsernameLoading(false);
    }
  }

  async function handlePinChange(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (newPin !== confirmPin) {
      toast.error("PINs do not match!");
      return;
    }
    if (newPin.length < 4 || newPin.length > 6) {
      toast.error("PIN must be 4-6 digits.");
      return;
    }

    setPinLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${user.uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "setPin", pin: newPin }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update PIN");
      toast.success("Transaction PIN updated successfully!");
      setNewPin("");
      setConfirmPin("");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Failed to update PIN");
    } finally {
      setPinLoading(false);
    }
  }

  if (profileLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Header */}
      <div className="bg-gradient-to-br from-indigo-900 to-indigo-800 rounded-3xl p-8 sm:p-10 text-white shadow-lg relative overflow-hidden mb-8">
        <div className="relative z-10">
          <h1 className="text-3xl font-extrabold mb-3">Security & Profile</h1>
          <p className="text-indigo-200 text-sm leading-relaxed max-w-xl">
            Manage your personal data, update your master password, and enforce numeric constraints for out-going transactions.
          </p>
        </div>
        <div className="absolute right-0 top-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute left-10 bottom-0 w-40 h-40 bg-indigo-500/20 rounded-full blur-2xl translate-y-1/4" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Contact info Block */}
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-sm">
            <h2 className="text-sm font-bold text-gray-900 mb-6 flex items-center gap-2">
              <User className="w-4 h-4 text-orange-500" /> Profile Information
            </h2>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><User className="w-3.5 h-3.5"/> Full Name</p>
                <p className="font-bold text-gray-900">{profile?.displayName || "Unknown User"}</p>
              </div>
              
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><AtSign className="w-3.5 h-3.5"/> Username</p>
                <p className="font-mono text-gray-900 bg-gray-50 px-2 py-1 rounded inline-block text-sm">{profile?.username || <span className="text-gray-400 italic font-sans font-normal">not set</span>}</p>
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5"/> Email Address</p>
                <p className="font-medium text-gray-700 break-all">{user?.email || <span className="text-gray-400 italic">not set</span>}</p>
              </div>
              
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5"/> Phone Number</p>
                <p className="font-mono text-gray-900 bg-gray-50 px-2 py-1 rounded inline-block text-sm">{profile?.phoneNumber || "Not assigned"}</p>
              </div>

              {/* Credit Limit — read-only */}
              <div className="pt-4 border-t border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-orange-400" /> Credit Limit
                </p>
                {(profile?.creditLimit ?? 0) > 0 ? (
                  <p className="font-bold text-orange-600 text-lg">৳{(profile?.creditLimit ?? 0).toLocaleString()}</p>
                ) : (
                  <p className="font-mono text-gray-400 text-sm italic">No credit assigned</p>
                )}
                <p className="text-[10px] text-gray-400 mt-1">Assigned by admin. Spend this when wallet balance is ৳0.</p>
              </div>
            </div>
            
            <div className="mt-6 pt-5 border-t border-gray-100 text-xs text-gray-400 space-y-1 font-medium">
              <p>Role: <span className="uppercase text-indigo-500">{profile?.role}</span></p>
              <p>Account ID: <span className="font-mono text-[10px] break-all">{user?.uid}</span></p>
            </div>
          </div>
        </div>

        {/* Security Forms block */}
        <div className="md:col-span-2 space-y-6">

          {/* Username Change Form */}
          <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                <AtSign className="w-5 h-5 text-blue-500" /> Username
              </h2>
              <p className="text-sm text-gray-500">Set a username to login with instead of (or alongside) your email.</p>
            </div>
            <form onSubmit={handleUsernameChange} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">New Username</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-mono text-sm select-none">@</span>
                  <input
                    type="text"
                    required
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    placeholder="your_username"
                    maxLength={20}
                    disabled={usernameLoading}
                    className="w-full pl-8 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-base font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors disabled:opacity-60"
                  />
                </div>
                <p className="text-xs text-gray-400 mt-1.5">3–20 chars · letters, numbers, underscores only</p>
              </div>
              <button type="submit" disabled={usernameLoading || newUsername.length < 3}
                className="inline-flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50">
                {usernameLoading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                Save Username
              </button>
            </form>
          </div>

          {/* PIN Setup Form */}
          <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-sm">
            <div className="mb-6 flex justify-between items-start">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-indigo-500" /> Transaction PIN
                </h2>
                <p className="text-sm text-gray-500">Create a 4-6 digit sequence used exclusively for approving outgoing funds.</p>
              </div>
              {profile?.pin && (
                <span className="bg-green-50 text-green-600 px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap">PIN Configured</span>
              )}
            </div>

            <form onSubmit={handlePinChange}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">New PIN</label>
                  <input type="password" required maxLength={6}
                    value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/[^0-9]/g, ''))} 
                    placeholder="••••" disabled={pinLoading}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-lg tracking-[0.25em] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Confirm PIN</label>
                  <input type="password" required maxLength={6}
                    value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/[^0-9]/g, ''))} 
                    placeholder="••••" disabled={pinLoading}
                    className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-lg tracking-[0.25em] font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors" />
                </div>
              </div>
              <button type="submit" disabled={pinLoading || !newPin || !confirmPin}
                className="inline-flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50">
                {pinLoading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
                Save PIN Record
              </button>
            </form>
          </div>

          {/* Change Password Form */}
          <div className="bg-white border border-gray-100 rounded-3xl p-6 sm:p-8 shadow-sm">
            <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
              <Lock className="w-5 h-5 text-orange-500" /> Account Password
            </h2>
            <p className="text-sm text-gray-500 mb-6">Update the master credential that grants basic login access to this account.</p>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Current Password</label>
                <input type="password" required
                  value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} disabled={passwordLoading}
                  className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-colors" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">New Password</label>
                  <input type="password" required minLength={6}
                    value={newPassword} onChange={(e) => setNewPassword(e.target.value)} disabled={passwordLoading}
                    className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-colors" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Confirm New Password</label>
                  <input type="password" required minLength={6}
                    value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={passwordLoading}
                    className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white transition-colors" />
                </div>
              </div>
              
              <div className="pt-4 flex items-center justify-between border-t border-gray-100 mt-6">
                <p className="text-xs text-gray-400 font-medium max-w-[200px]"><Info className="w-3.5 h-3.5 inline mr-1" /> Re-authentication required for modifications.</p>
                <button type="submit" disabled={passwordLoading || !currentPassword || !newPassword}
                  className="inline-flex items-center justify-center gap-2 bg-orange-500 text-white font-bold py-3 px-6 rounded-xl hover:bg-orange-600 transition-all disabled:opacity-50">
                  {passwordLoading ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>
          
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useUsers } from "@/lib/hooks/admin/useUsers";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { WalletAmount } from "@/components/admin/WalletAmount";
import { createUserAccount } from "@/lib/functions";
import { relativeTime, getInitials } from "@/lib/utils";
import { UserRole, UserStatus } from "@/types";
import { toast } from "sonner";
import { Search, UserPlus, Users, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/Table";
import { Modal, ModalContent, ModalHeader, ModalTitle, ModalDescription } from "@/components/ui/Modal";
import { Card, CardContent } from "@/components/ui/Card";

function RegisterUserDialog({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [saving, setSaving] = useState(false);
  const [successData, setSuccessData] = useState<{ displayName: string; username: string; email: string; pass: string; pin: string } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    
    const genPass = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-2).toUpperCase();
    const genPin = Math.floor(1000 + Math.random() * 9000).toString();

    try {
      await createUserAccount({ 
        displayName, 
        username,
        email: email || undefined, 
        password: genPass, 
        pin: genPin,
        phoneNumber: phoneNumber || undefined 
      });
      toast.success("User created successfully");
      
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

  return (
    <Modal open={open} onOpenChange={(val) => !val && !saving && handleClose()}>
      <ModalContent className="sm:max-w-md">
        {successData ? (
          <>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <UserPlus className="h-6 w-6" />
            </div>
            <ModalHeader className="text-center">
              <ModalTitle>User Created!</ModalTitle>
              <ModalDescription>Copy credentials and share securely.</ModalDescription>
            </ModalHeader>
            <div className="my-4 space-y-3 rounded-lg border border-outline-variant bg-surface p-4 text-sm">
              <div className="flex justify-between"><span className="text-on-surface-variant">Name:</span> <span className="font-semibold">{successData.displayName}</span></div>
              <div className="flex justify-between"><span className="text-on-surface-variant">Username:</span> <span className="font-mono font-bold text-primary">{successData.username}</span></div>
              {successData.email && <div className="flex justify-between"><span className="text-on-surface-variant">Email:</span> <span>{successData.email}</span></div>}
              <div className="flex justify-between"><span className="text-on-surface-variant">Password:</span> <span className="font-mono text-orange-600">{successData.pass}</span></div>
              <div className="flex justify-between"><span className="text-on-surface-variant">PIN:</span> <span className="font-mono text-violet-600">{successData.pin}</span></div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>Done</Button>
              <Button className="flex-1" onClick={handleCopy}>Copy All</Button>
            </div>
          </>
        ) : (
          <>
            <ModalHeader>
              <ModalTitle>Register New User</ModalTitle>
              <ModalDescription>Credentials will be generated automatically.</ModalDescription>
            </ModalHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-on-surface-variant">Full Name</label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required placeholder="Md. Rahim Uddin" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-on-surface-variant">Username</label>
                  <Input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} required placeholder="username" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-on-surface-variant">Email (Optional)</label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="user@example.com" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-on-surface-variant">Phone (Optional)</label>
                <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+8801XXXXXXXXX" />
              </div>
              <div className="rounded border border-primary/20 bg-primary/5 p-2 text-xs text-primary">
                Password and PIN will be auto-generated.
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" type="button" onClick={handleClose} disabled={saving}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? "Creating..." : "Create User"}</Button>
              </div>
            </form>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}

export default function UsersPage() {
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<UserRole | "all">("all");
  const [status, setStatus] = useState<UserStatus | "all">("all");
  const [registerOpen, setRegisterOpen] = useState(false);
  const { users, loading, refetch } = useUsers({ search, role, status });

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#134235]">Users</h1>
          <p className="text-sm text-on-surface-variant">Manage all registered accounts and access control.</p>
        </div>
        <Button onClick={() => setRegisterOpen(true)}>
          <UserPlus className="mr-2 h-4 w-4" /> Register User
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant" />
          <Input 
            value={search} onChange={(e) => setSearch(e.target.value)} 
            placeholder="Search by name or email…" 
            className="pl-9" 
          />
        </div>
        <select value={role} onChange={(e) => setRole(e.target.value as UserRole | "all")} className="h-10 rounded-md border border-outline-variant bg-surface px-3 text-sm focus:border-primary focus:outline-none">
          <option value="all">All Roles</option>
          <option value="user">User</option>
          <option value="admin">Admin</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value as UserStatus | "all")} className="h-10 rounded-md border border-outline-variant bg-surface px-3 text-sm focus:border-primary focus:outline-none">
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <Card>
        <div className="flex items-center justify-between border-b border-outline-variant/30 px-4 py-3">
          <h4 className="font-semibold">{loading ? "Loading..." : `${users.length} Account${users.length !== 1 ? "s" : ""}`}</h4>
          <Users className="h-4 w-4 text-on-surface-variant" />
        </div>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Wallet</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Last Login</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && Array(5).fill(0).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={6} className="h-14"><div className="h-4 animate-pulse rounded bg-surface-container" /></TableCell>
                </TableRow>
              ))}
              {!loading && users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-on-surface-variant">No users found</TableCell>
                </TableRow>
              )}
              {!loading && users.map((u) => (
                <TableRow key={u.uid}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10 text-xs font-bold text-primary">
                        {getInitials(u.displayName || u.email)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{u.displayName}</p>
                        <p className="truncate text-xs text-on-surface-variant">{u.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`rounded bg-surface-container px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${u.role === "admin" ? "bg-red-50 text-red-700" : "text-on-surface-variant"}`}>
                      {u.role}
                    </span>
                  </TableCell>
                  <TableCell className="font-semibold text-[#134235]">
                    <WalletAmount amount={u.walletBalance} />
                  </TableCell>
                  <TableCell><StatusBadge status={u.status} /></TableCell>
                  <TableCell className="hidden text-xs text-on-surface-variant sm:table-cell">{relativeTime(u.lastLoginAt)}</TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-on-surface-variant" asChild>
                        <Link href={`/admin/users/${u.uid}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <RegisterUserDialog open={registerOpen} onClose={() => setRegisterOpen(false)} onSuccess={refetch} />
    </div>
  );
}

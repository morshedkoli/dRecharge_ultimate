"use client";
import { useState } from "react";
import { useModalEffect } from "@/lib/hooks/useModalEffect";

interface Props {
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: "destructive" | "default";
  onConfirm: () => Promise<void>;
  children: React.ReactNode; // trigger element
}

export function ConfirmDialog({ title, description, confirmLabel, confirmVariant = "default", onConfirm, children }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useModalEffect(open);

  async function handleConfirm() {
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
      setOpen(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Something went wrong";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <span onClick={() => setOpen(true)} className="cursor-pointer">{children}</span>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => !loading && setOpen(false)} />
          <div ref={containerRef} className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-2">{title}</h2>
            <p className="text-sm text-gray-600 mb-6">{description}</p>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setOpen(false)} disabled={loading}
                className="px-4 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
              <button onClick={handleConfirm} disabled={loading}
                className={`px-4 py-2 text-sm font-medium rounded-lg text-white disabled:opacity-50 ${
                  confirmVariant === "destructive" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                }`}>
                {loading ? "Please wait…" : confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

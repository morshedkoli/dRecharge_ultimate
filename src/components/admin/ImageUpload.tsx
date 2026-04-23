"use client";
import { useRef, useState, useCallback, DragEvent } from "react";
import { UploadCloud, X, ImageOff, Loader2, CheckCircle2 } from "lucide-react";

const IMGBB_API_KEY = process.env.NEXT_PUBLIC_IMGBB_API_KEY!;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/svg+xml"];
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB (ImgBB free limit)

interface ImageUploadProps {
  /** Current image URL (shows preview when set) */
  value: string;
  /** Called with the final ImgBB URL after a successful upload */
  onChange: (url: string) => void;
  /** Label text shown above the drop zone */
  label?: string;
  /** Optional hint appended to the label */
  hint?: string;
  /** Extra className on the outer wrapper */
  className?: string;
  /** Unused — kept for API compatibility with previous Firebase version */
  storagePath?: string;
}

async function uploadToImgBB(file: File): Promise<string> {
  const form = new FormData();
  form.append("image", file);
  form.append("name", file.name);

  const res = await fetch("/api/admin/upload", {
    method: "POST",
    body: form,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error ?? `Upload failed (${res.status})`);
  }

  const data = await res.json();
  return data.url;
}

export function ImageUpload({
  value,
  onChange,
  label = "Image",
  hint,
  className = "",
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [imgErr, setImgErr] = useState(false);

  const isUrl = value.startsWith("http://") || value.startsWith("https://");
  const isEmoji = value.length > 0 && !isUrl;

  const upload = useCallback(
    async (file: File) => {
      setError(null);
      setUploaded(false);
      setImgErr(false);

      if (!ACCEPTED.includes(file.type)) {
        setError("Only JPG, PNG, WebP, GIF and SVG files are supported.");
        return;
      }
      if (file.size > MAX_BYTES) {
        setError("File must be ≤ 4 MB.");
        return;
      }

      setUploading(true);
      try {
        const url = await uploadToImgBB(file);
        onChange(url);
        setUploaded(true);
        setTimeout(() => setUploaded(false), 2500);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [onChange]
  );

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    upload(files[0]);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  function handleClear() {
    onChange("");
    setError(null);
    setUploaded(false);
    setImgErr(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {/* Label */}
      {label && (
        <label className="text-sm font-medium text-gray-700 block">
          {label}
          {hint && (
            <span className="ml-1 text-gray-400 font-normal text-xs">{hint}</span>
          )}
        </label>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !uploading && inputRef.current?.click()}
        className={[
          "relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 min-h-[130px] group select-none",
          dragOver
            ? "border-orange-400 bg-orange-50 scale-[1.01]"
            : "border-gray-200 hover:border-orange-300 hover:bg-orange-50/40 bg-gray-50/50",
          uploading ? "pointer-events-none" : "",
        ].join(" ")}
      >
        {/* Existing image preview */}
        {value && (
          <div className="absolute inset-0 flex items-center justify-center p-3 rounded-2xl overflow-hidden">
            {isUrl && !imgErr ? (
              <img
                src={value}
                alt="preview"
                className="max-h-[100px] max-w-full object-contain rounded-xl shadow-sm"
                onError={() => setImgErr(true)}
              />
            ) : isEmoji ? (
              <span className="text-5xl leading-none">{value}</span>
            ) : imgErr ? (
              <div className="flex flex-col items-center gap-1 text-gray-400">
                <ImageOff className="w-8 h-8" />
                <span className="text-xs">Broken URL</span>
              </div>
            ) : null}

            {/* Hover overlay — "Replace" hint */}
            <div className="absolute inset-0 bg-white/0 group-hover:bg-white/70 transition-all rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100">
              <div className="flex flex-col items-center gap-1 text-gray-600">
                <UploadCloud className="w-6 h-6" />
                <span className="text-xs font-semibold">Replace</span>
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!value && !uploading && (
          <>
            <UploadCloud
              className={`w-8 h-8 transition-colors ${
                dragOver ? "text-orange-500" : "text-gray-300 group-hover:text-orange-400"
              }`}
            />
            <div className="text-center px-4">
              <p className="text-sm font-medium text-gray-500 group-hover:text-gray-700 transition-colors">
                Drag & drop or{" "}
                <span className="text-orange-500 font-semibold">browse</span>
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                JPG · PNG · WebP · GIF · SVG &nbsp;·&nbsp; max 4 MB
              </p>
            </div>
          </>
        )}

        {/* Uploading spinner */}
        {uploading && (
          <div className="absolute inset-0 bg-white/90 rounded-2xl flex flex-col items-center justify-center gap-2 z-10">
            <Loader2 className="w-7 h-7 text-orange-500 animate-spin" />
            <span className="text-xs text-gray-500 font-medium">Uploading…</span>
          </div>
        )}

        {/* Upload success flash */}
        {uploaded && !uploading && (
          <div className="absolute inset-0 bg-green-50/90 rounded-2xl flex flex-col items-center justify-center gap-1 z-10 pointer-events-none">
            <CheckCircle2 className="w-7 h-7 text-green-500" />
            <span className="text-xs text-green-600 font-semibold">Uploaded!</span>
          </div>
        )}
      </div>

      {/* URL / emoji text input row */}
      <div className="flex gap-2 items-center">
        <input
          type="text"
          value={value}
          onChange={(e) => { onChange(e.target.value); setImgErr(false); setError(null); }}
          placeholder="Or paste an image URL / emoji  e.g. 🏦"
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 text-gray-700 bg-white"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            title="Clear"
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1.5">
          <X className="w-3 h-3 shrink-0" /> {error}
        </p>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

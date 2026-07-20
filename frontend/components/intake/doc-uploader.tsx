"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { UploadCloud, FileText, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { API, type Profile } from "@/lib/api";
import { DOC_TYPES } from "@/lib/intake";
import { Select } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type Parsed = { filename: string; fields: string[] };

/** Human summary of which profile fields a parse produced. */
function summariseParsed(parsed: Record<string, unknown>): string[] {
  const out: string[] = [];
  const labels: Record<string, string> = {
    full_name: "Name",
    home_city: "City",
    last_qualification: "Qualification",
    english_test: "English test",
    budget: "Budget",
    target: "Target",
    notes: "Notes",
  };
  for (const [k, v] of Object.entries(parsed)) {
    if (k === "documents_provided") continue;
    if (v == null || (Array.isArray(v) && v.length === 0)) continue;
    out.push(labels[k] ?? k);
  }
  return out;
}

export function DocUploader({
  frozen,
  documents,
  onParsed,
}: {
  frozen: boolean;
  documents: Profile["documents_provided"];
  onParsed: () => void;
}) {
  const [docType, setDocType] = useState(DOC_TYPES[0].value);
  const [progress, setProgress] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastParsed, setLastParsed] = useState<Parsed | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function upload(file: File) {
    setError(null);
    setLastParsed(null);
    setProgress(0);
    const form = new FormData();
    form.append("file", file);
    form.append("doc_type", docType);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API}/api/intake/document`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      setProgress(null);
      try {
        const data = JSON.parse(xhr.responseText);
        if (xhr.status >= 200 && xhr.status < 300) {
          setLastParsed({ filename: file.name, fields: summariseParsed(data.parsed ?? {}) });
          onParsed();
        } else {
          setError(String(data?.detail ?? `Upload failed (${xhr.status})`));
        }
      } catch {
        setError("Upload failed — unexpected response.");
      }
    };
    xhr.onerror = () => {
      setProgress(null);
      setError(`Could not reach the backend at ${API}.`);
    };
    xhr.send(form);
  }

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) upload(file);
  }

  const busy = progress !== null;

  return (
    <div className="space-y-4">
      {!frozen && (
        <>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="text-sm text-muted">Document type</span>
            <Select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="sm:max-w-56"
            >
              {DOC_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              handleFiles(e.dataTransfer.files);
            }}
            onClick={() => inputRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors",
              dragging
                ? "border-brand bg-brand/5"
                : "border-border-strong hover:border-brand/50 hover:bg-surface-2",
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-3">
              {busy ? (
                <Loader2 className="h-5 w-5 animate-spin text-brand" />
              ) : (
                <UploadCloud className="h-5 w-5 text-brand" />
              )}
            </div>
            <p className="text-sm font-medium">
              {busy ? "Parsing document…" : "Drag & drop or click to upload"}
            </p>
            <p className="mt-1 text-xs text-muted-2">PDF, PNG, JPG or WEBP · read by GPT-4o-mini vision</p>

            {busy && (
              <div className="mt-4 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-surface-3">
                <motion.div
                  className="h-full brand-gradient"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                />
              </div>
            )}
          </div>
        </>
      )}

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-2 rounded-lg border border-danger/25 bg-danger-soft/60 p-3 text-sm text-danger"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </motion.div>
        )}
        {lastParsed && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 rounded-lg border border-success/25 bg-success-soft/50 p-3 text-sm"
          >
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            <span className="text-foreground">
              Parsed <span className="font-medium">{lastParsed.filename}</span>
              {lastParsed.fields.length > 0 ? (
                <> — filled {lastParsed.fields.join(", ")}. Review the fields on the left.</>
              ) : (
                <> — no new fields could be extracted.</>
              )}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {documents && documents.length > 0 && (
        <ul className="space-y-2">
          {documents.map((d, i) => (
            <li
              key={i}
              className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm"
            >
              <FileText className="h-4 w-4 text-muted" />
              <span className="min-w-0 flex-1 truncate">{d.filename ?? "document"}</span>
              <span className="rounded bg-surface-3 px-2 py-0.5 text-xs text-muted">{d.type}</span>
              {d.parsed_ok ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <AlertCircle className="h-4 w-4 text-warning" />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

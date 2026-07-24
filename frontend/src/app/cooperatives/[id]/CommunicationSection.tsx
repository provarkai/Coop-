"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  api,
  ApiError,
  downloadFile,
  saveBlob,
  type AppNotification,
  type DocumentCategory,
  type DocumentMetadata,
  type NotificationChannel,
} from "@/lib/api";

const DOCUMENT_CATEGORIES: DocumentCategory[] = [
  "BYLAWS",
  "POLICY",
  "FINANCIAL_STATEMENT",
  "MEETING_MINUTES",
  "FORM",
  "OTHER",
];

const NOTIFICATION_CHANNELS: NotificationChannel[] = ["EMAIL", "SMS", "WHATSAPP", "PUSH"];

function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-red-600 dark:text-red-400">{message}</p>;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function CommunicationSection({ cooperativeId }: { cooperativeId: string }) {
  const [documents, setDocuments] = useState<DocumentMetadata[] | null>(null);
  const [myNotifications, setMyNotifications] = useState<AppNotification[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docTitle, setDocTitle] = useState("");
  const [docCategory, setDocCategory] = useState<DocumentCategory>("OTHER");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [announceChannel, setAnnounceChannel] = useState<NotificationChannel>("EMAIL");
  const [announceSubject, setAnnounceSubject] = useState("");
  const [announceBody, setAnnounceBody] = useState("");
  const [announceError, setAnnounceError] = useState<string | null>(null);

  async function reload() {
    try {
      const [docs, notifications] = await Promise.all([
        api.listDocuments(cooperativeId),
        api.listMyNotifications(cooperativeId),
      ]);
      setDocuments(docs);
      setMyNotifications(notifications);
    } catch {
      setDocuments(null);
    }
  }

  useEffect(() => {
    async function load() {
      try {
        await reload();
      } catch {
        setDocuments(null);
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cooperativeId]);

  async function onUploadDocument(e: FormEvent) {
    e.preventDefault();
    setDocError(null);
    if (!docFile) {
      setDocError("Choose a file to upload");
      return;
    }
    setUploading(true);
    try {
      const contentBase64 = await fileToBase64(docFile);
      await api.uploadDocument(cooperativeId, {
        title: docTitle,
        category: docCategory,
        fileName: docFile.name,
        mimeType: docFile.type || "application/octet-stream",
        contentBase64,
      });
      setDocTitle("");
      setDocFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setDocuments(await api.listDocuments(cooperativeId));
    } catch (err) {
      setDocError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setUploading(false);
    }
  }

  async function onDownloadDocument(doc: DocumentMetadata) {
    setDocError(null);
    try {
      const blob = await downloadFile(`/cooperatives/${cooperativeId}/documents/${doc.id}`);
      saveBlob(blob, doc.fileName);
    } catch (err) {
      setDocError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onDeleteDocument(documentId: string) {
    setDocError(null);
    try {
      await api.deleteDocument(cooperativeId, documentId);
      setDocuments(await api.listDocuments(cooperativeId));
    } catch (err) {
      setDocError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onSendAnnouncement(e: FormEvent) {
    e.preventDefault();
    setAnnounceError(null);
    try {
      await api.sendAnnouncement(cooperativeId, {
        channel: announceChannel,
        subject: announceSubject || undefined,
        body: announceBody,
      });
      setAnnounceSubject("");
      setAnnounceBody("");
      setMyNotifications(await api.listMyNotifications(cooperativeId));
    } catch (err) {
      setAnnounceError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  if (!documents) return null;

  return (
    <>
      <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="font-semibold text-black dark:text-zinc-50">Documents</h2>
        <ErrorText message={docError} />
        <ul className="space-y-1 text-sm">
          {documents.map((doc) => (
            <li key={doc.id} className="flex items-center justify-between">
              <span>
                {doc.title} <span className="text-xs text-zinc-500">({doc.category})</span>
              </span>
              <span className="flex items-center gap-2 text-xs text-zinc-500">
                {doc.fileName} · {formatBytes(doc.sizeBytes)}
                <button
                  type="button"
                  onClick={() => void onDownloadDocument(doc)}
                  className="rounded-full border border-black/[.08] px-2 py-0.5 dark:border-white/[.145]"
                >
                  Download
                </button>
                <button
                  type="button"
                  onClick={() => void onDeleteDocument(doc.id)}
                  className="rounded-full border border-black/[.08] px-2 py-0.5 dark:border-white/[.145]"
                >
                  Delete
                </button>
              </span>
            </li>
          ))}
          {documents.length === 0 && <li className="text-zinc-500 dark:text-zinc-500">No documents uploaded yet.</li>}
        </ul>
        <form onSubmit={onUploadDocument} className="flex flex-wrap items-center gap-2">
          <input
            className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Document title"
            value={docTitle}
            onChange={(e) => setDocTitle(e.target.value)}
            required
          />
          <select
            className="rounded-md border border-black/[.08] bg-transparent px-2 py-1.5 text-sm dark:border-white/[.145]"
            value={docCategory}
            onChange={(e) => setDocCategory(e.target.value as DocumentCategory)}
          >
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            ref={fileInputRef}
            type="file"
            className="text-sm"
            onChange={(e) => setDocFile(e.target.files?.[0] ?? null)}
            required
          />
          <button
            type="submit"
            disabled={uploading}
            className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] disabled:opacity-50 dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            {uploading ? "Uploading…" : "Upload"}
          </button>
        </form>
      </section>

      <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="font-semibold text-black dark:text-zinc-50">Announcements & notifications</h2>
        <p className="text-xs text-zinc-500">
          Email/SMS/WhatsApp/push are simulated here (no real provider) — sends are logged, not actually delivered.
        </p>
        <ErrorText message={announceError} />
        <ul className="space-y-1 text-sm">
          {myNotifications.map((n) => (
            <li key={n.id} className="flex items-center justify-between">
              <span>
                {n.subject ? `${n.subject} — ` : ""}
                {n.body}
              </span>
              <span className="text-xs text-zinc-500">
                {n.channel} · {n.status}
              </span>
            </li>
          ))}
          {myNotifications.length === 0 && (
            <li className="text-zinc-500 dark:text-zinc-500">No notifications received yet.</li>
          )}
        </ul>
        <form onSubmit={onSendAnnouncement} className="flex flex-wrap gap-2">
          <select
            className="rounded-md border border-black/[.08] bg-transparent px-2 py-1.5 text-sm dark:border-white/[.145]"
            value={announceChannel}
            onChange={(e) => setAnnounceChannel(e.target.value as NotificationChannel)}
          >
            {NOTIFICATION_CHANNELS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <input
            className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Subject (optional)"
            value={announceSubject}
            onChange={(e) => setAnnounceSubject(e.target.value)}
          />
          <input
            className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Message"
            value={announceBody}
            onChange={(e) => setAnnounceBody(e.target.value)}
            required
          />
          <button
            type="submit"
            className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Send to all members
          </button>
        </form>
      </section>
    </>
  );
}

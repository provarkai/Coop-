"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  api,
  ApiError,
  type AuthUser,
  type Meeting,
  type MeetingType,
  type VoteChoice,
} from "@/lib/api";

const MEETING_TYPES: MeetingType[] = ["AGM", "BOARD", "COMMITTEE", "SPECIAL"];
const WAT_OFFSET_MS = 60 * 60 * 1000; // Africa/Lagos is a fixed UTC+1, no DST

function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-red-600 dark:text-red-400">{message}</p>;
}

/** Interprets a `datetime-local` input value as Africa/Lagos (WAT) wall-clock time and returns the UTC ISO instant. */
function watInputToUtcIso(localValue: string): string {
  const [datePart, timePart] = localValue.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const utcMs = Date.UTC(year, month - 1, day, hour, minute) - WAT_OFFSET_MS;
  return new Date(utcMs).toISOString();
}

/** Formats a UTC ISO instant for display in Africa/Lagos (WAT) time, regardless of the viewer's own timezone. */
function formatWat(iso: string): string {
  const formatted = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
  return `${formatted} WAT`;
}

function statusColor(status: string) {
  if (status === "PASSED" || status === "COMPLETED" || status === "ATTENDED" || status === "CONFIRMED") {
    return "text-green-600 dark:text-green-400";
  }
  if (status === "REJECTED" || status === "WITHDRAWN" || status === "DECLINED" || status === "ABSENT" || status === "CANCELLED") {
    return "text-red-600 dark:text-red-400";
  }
  return "text-zinc-500";
}

export default function MeetingsSection({ cooperativeId, me }: { cooperativeId: string; me: AuthUser | null }) {
  const [meetings, setMeetings] = useState<Meeting[] | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<Meeting | null>(null);

  const [title, setTitle] = useState("");
  const [type, setType] = useState<MeetingType>("SPECIAL");
  const [scheduledAt, setScheduledAt] = useState("");
  const [location, setLocation] = useState("");
  const [agendaDraft, setAgendaDraft] = useState("");
  const [agendaItems, setAgendaItems] = useState<string[]>([]);
  const [createError, setCreateError] = useState<string | null>(null);

  const [minutesDraft, setMinutesDraft] = useState("");
  const [minutesError, setMinutesError] = useState<string | null>(null);

  const [resolutionTitle, setResolutionTitle] = useState("");
  const [resolutionAgendaItemId, setResolutionAgendaItemId] = useState("");
  const [resolutionError, setResolutionError] = useState<string | null>(null);

  const [actionError, setActionError] = useState<string | null>(null);

  async function reload() {
    try {
      setMeetings(await api.listMeetings(cooperativeId));
    } catch {
      setMeetings(null);
    }
  }

  useEffect(() => {
    async function load() {
      try {
        await reload();
      } catch {
        setMeetings(null);
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cooperativeId]);

  async function selectMeeting(meetingId: string) {
    setActionError(null);
    try {
      const detail = await api.getMeeting(cooperativeId, meetingId);
      setSelectedMeeting(detail);
      setMinutesDraft(detail.minutes ?? "");
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function refreshSelected() {
    if (!selectedMeeting) return;
    const detail = await api.getMeeting(cooperativeId, selectedMeeting.id);
    setSelectedMeeting(detail);
  }

  function addAgendaDraft() {
    if (!agendaDraft.trim()) return;
    setAgendaItems([...agendaItems, agendaDraft.trim()]);
    setAgendaDraft("");
  }

  async function onCreateMeeting(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    if (!scheduledAt) {
      setCreateError("Choose a date and time (WAT)");
      return;
    }
    try {
      await api.createMeeting(cooperativeId, {
        title,
        type,
        scheduledAt: watInputToUtcIso(scheduledAt),
        location: location || undefined,
        agendaItems: agendaItems.map((t) => ({ title: t })),
      });
      setTitle("");
      setScheduledAt("");
      setLocation("");
      setAgendaItems([]);
      await reload();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onRsvp(status: "CONFIRMED" | "DECLINED") {
    if (!selectedMeeting) return;
    setActionError(null);
    try {
      await api.rsvpToMeeting(cooperativeId, selectedMeeting.id, status);
      await refreshSelected();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onRecordAttendance(userId: string, status: "ATTENDED" | "ABSENT" | "EXCUSED") {
    if (!selectedMeeting) return;
    setActionError(null);
    try {
      await api.recordMeetingAttendance(cooperativeId, selectedMeeting.id, userId, status);
      await refreshSelected();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onProposeResolution(e: FormEvent) {
    e.preventDefault();
    setResolutionError(null);
    if (!selectedMeeting) return;
    try {
      await api.proposeResolution(cooperativeId, selectedMeeting.id, {
        title: resolutionTitle,
        agendaItemId: resolutionAgendaItemId || undefined,
      });
      setResolutionTitle("");
      setResolutionAgendaItemId("");
      await refreshSelected();
    } catch (err) {
      setResolutionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onVote(resolutionId: string, choice: VoteChoice) {
    if (!selectedMeeting) return;
    setActionError(null);
    try {
      await api.castVote(cooperativeId, selectedMeeting.id, resolutionId, choice);
      await refreshSelected();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onCloseResolution(resolutionId: string) {
    if (!selectedMeeting) return;
    setActionError(null);
    try {
      await api.closeResolution(cooperativeId, selectedMeeting.id, resolutionId);
      await refreshSelected();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onWithdrawResolution(resolutionId: string) {
    if (!selectedMeeting) return;
    setActionError(null);
    try {
      await api.withdrawResolution(cooperativeId, selectedMeeting.id, resolutionId);
      await refreshSelected();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onRecordMinutes(e: FormEvent) {
    e.preventDefault();
    setMinutesError(null);
    if (!selectedMeeting) return;
    try {
      await api.recordMeetingMinutes(cooperativeId, selectedMeeting.id, minutesDraft);
      await refreshSelected();
      await reload();
    } catch (err) {
      setMinutesError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  if (!meetings) return null;

  const myAttendance = selectedMeeting?.attendances?.find((a) => a.userId === me?.id);

  return (
    <>
      <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="font-semibold text-black dark:text-zinc-50">Meetings & governance</h2>
        <p className="text-xs text-zinc-500">Times are shown and entered in West Africa Time (WAT, UTC+1).</p>
        <ErrorText message={createError} />
        <ul className="space-y-1 text-sm">
          {meetings.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => void selectMeeting(m.id)}
                className={`flex w-full items-center justify-between rounded-md px-2 py-1 text-left hover:bg-black/[.03] dark:hover:bg-white/[.06] ${
                  selectedMeeting?.id === m.id ? "bg-black/[.04] dark:bg-white/[.08]" : ""
                }`}
              >
                <span>
                  {m.title} <span className="text-xs text-zinc-500">({m.type})</span>
                </span>
                <span className="text-xs text-zinc-500">
                  {formatWat(m.scheduledAt)} · <span className={statusColor(m.status)}>{m.status}</span>
                </span>
              </button>
            </li>
          ))}
          {meetings.length === 0 && <li className="text-zinc-500 dark:text-zinc-500">No meetings scheduled yet.</li>}
        </ul>

        <form onSubmit={onCreateMeeting} className="space-y-2 border-t border-black/[.08] pt-3 dark:border-white/[.145]">
          <div className="flex flex-wrap gap-2">
            <input
              className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
              placeholder="Meeting title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            <select
              className="rounded-md border border-black/[.08] bg-transparent px-2 py-1.5 text-sm dark:border-white/[.145]"
              value={type}
              onChange={(e) => setType(e.target.value as MeetingType)}
            >
              {MEETING_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              type="datetime-local"
              className="rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
            />
            <input
              className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
              placeholder="Location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
              placeholder="Agenda item"
              value={agendaDraft}
              onChange={(e) => setAgendaDraft(e.target.value)}
            />
            <button
              type="button"
              onClick={addAgendaDraft}
              className="rounded-full border border-black/[.08] px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
            >
              Add agenda item
            </button>
          </div>
          {agendaItems.length > 0 && (
            <ul className="pl-3 text-xs text-zinc-500">
              {agendaItems.map((item, i) => (
                <li key={i}>{i + 1}. {item}</li>
              ))}
            </ul>
          )}
          <button
            type="submit"
            className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Schedule meeting
          </button>
        </form>
      </section>

      {selectedMeeting && (
        <section className="space-y-4 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-black dark:text-zinc-50">{selectedMeeting.title}</h2>
            <span className={`text-xs ${statusColor(selectedMeeting.status)}`}>{selectedMeeting.status}</span>
          </div>
          <p className="text-sm text-zinc-500">
            {formatWat(selectedMeeting.scheduledAt)} {selectedMeeting.location && `· ${selectedMeeting.location}`}
          </p>
          <ErrorText message={actionError} />

          <div>
            <h3 className="text-sm font-medium text-black dark:text-zinc-50">Agenda</h3>
            <ul className="pl-3 text-sm text-zinc-500">
              {selectedMeeting.agendaItems.map((item) => (
                <li key={item.id}>
                  {item.order}. {item.title}
                </li>
              ))}
              {selectedMeeting.agendaItems.length === 0 && <li>No agenda items.</li>}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-medium text-black dark:text-zinc-50">Your RSVP</h3>
            <div className="flex items-center gap-2 pt-1">
              <span className={`text-sm ${statusColor(myAttendance?.status ?? "")}`}>
                {myAttendance?.status ?? "INVITED"}
              </span>
              <button
                type="button"
                onClick={() => void onRsvp("CONFIRMED")}
                className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
              >
                Confirm
              </button>
              <button
                type="button"
                onClick={() => void onRsvp("DECLINED")}
                className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
              >
                Decline
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-black dark:text-zinc-50">Attendance</h3>
            <ul className="space-y-1 pt-1 text-sm">
              {(selectedMeeting.attendances ?? []).map((a) => (
                <li key={a.id} className="flex items-center justify-between">
                  <span>
                    {a.user?.firstName} {a.user?.lastName}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className={`text-xs ${statusColor(a.status)}`}>{a.status}</span>
                    <button
                      type="button"
                      onClick={() => void onRecordAttendance(a.userId, "ATTENDED")}
                      className="rounded-full border border-black/[.08] px-2 py-0.5 text-xs dark:border-white/[.145]"
                    >
                      Attended
                    </button>
                    <button
                      type="button"
                      onClick={() => void onRecordAttendance(a.userId, "ABSENT")}
                      className="rounded-full border border-black/[.08] px-2 py-0.5 text-xs dark:border-white/[.145]"
                    >
                      Absent
                    </button>
                    <button
                      type="button"
                      onClick={() => void onRecordAttendance(a.userId, "EXCUSED")}
                      className="rounded-full border border-black/[.08] px-2 py-0.5 text-xs dark:border-white/[.145]"
                    >
                      Excused
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-medium text-black dark:text-zinc-50">Resolutions</h3>
            <ErrorText message={resolutionError} />
            <ul className="space-y-2 pt-1 text-sm">
              {(selectedMeeting.resolutions ?? []).map((r) => {
                const forCount = r.votes.filter((v) => v.choice === "FOR").length;
                const againstCount = r.votes.filter((v) => v.choice === "AGAINST").length;
                const abstainCount = r.votes.filter((v) => v.choice === "ABSTAIN").length;
                return (
                  <li key={r.id} className="rounded-md border border-black/[.06] p-2 dark:border-white/[.1]">
                    <div className="flex items-center justify-between">
                      <span>{r.title}</span>
                      <span className={`text-xs ${statusColor(r.status)}`}>{r.status}</span>
                    </div>
                    <p className="text-xs text-zinc-500">
                      FOR {forCount} · AGAINST {againstCount} · ABSTAIN {abstainCount}
                    </p>
                    {r.status === "PROPOSED" && (
                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => void onVote(r.id, "FOR")}
                          className="rounded-full border border-black/[.08] px-3 py-1 text-xs dark:border-white/[.145]"
                        >
                          Vote FOR
                        </button>
                        <button
                          type="button"
                          onClick={() => void onVote(r.id, "AGAINST")}
                          className="rounded-full border border-black/[.08] px-3 py-1 text-xs dark:border-white/[.145]"
                        >
                          Vote AGAINST
                        </button>
                        <button
                          type="button"
                          onClick={() => void onVote(r.id, "ABSTAIN")}
                          className="rounded-full border border-black/[.08] px-3 py-1 text-xs dark:border-white/[.145]"
                        >
                          Vote ABSTAIN
                        </button>
                        <button
                          type="button"
                          onClick={() => void onCloseResolution(r.id)}
                          className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium dark:border-white/[.145]"
                        >
                          Close & tally
                        </button>
                        <button
                          type="button"
                          onClick={() => void onWithdrawResolution(r.id)}
                          className="rounded-full border border-black/[.08] px-3 py-1 text-xs dark:border-white/[.145]"
                        >
                          Withdraw
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
              {(selectedMeeting.resolutions ?? []).length === 0 && (
                <li className="text-zinc-500 dark:text-zinc-500">No resolutions proposed yet.</li>
              )}
            </ul>
            <form onSubmit={onProposeResolution} className="flex flex-wrap gap-2 pt-2">
              <input
                className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
                placeholder="Resolution title"
                value={resolutionTitle}
                onChange={(e) => setResolutionTitle(e.target.value)}
                required
              />
              <select
                className="rounded-md border border-black/[.08] bg-transparent px-2 py-1.5 text-sm dark:border-white/[.145]"
                value={resolutionAgendaItemId}
                onChange={(e) => setResolutionAgendaItemId(e.target.value)}
              >
                <option value="">No agenda item</option>
                {selectedMeeting.agendaItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
              >
                Propose resolution
              </button>
            </form>
          </div>

          <div>
            <h3 className="text-sm font-medium text-black dark:text-zinc-50">Minutes</h3>
            <ErrorText message={minutesError} />
            {selectedMeeting.minutes && (
              <p className="whitespace-pre-wrap pt-1 text-sm text-zinc-500">{selectedMeeting.minutes}</p>
            )}
            <form onSubmit={onRecordMinutes} className="flex flex-wrap gap-2 pt-2">
              <textarea
                className="min-h-16 flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
                placeholder="Record meeting minutes"
                value={minutesDraft}
                onChange={(e) => setMinutesDraft(e.target.value)}
                required
              />
              <button
                type="submit"
                className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
              >
                Save minutes
              </button>
            </form>
          </div>
        </section>
      )}
    </>
  );
}

"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  api,
  ApiError,
  type ContributionGroup,
  type LandParcel,
  type ParcelReservation,
} from "@/lib/api";

function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-red-600 dark:text-red-400">{message}</p>;
}

function statusColor(status: string) {
  if (status === "PUBLISHED" || status === "CONFIRMED") return "text-green-600 dark:text-green-400";
  if (status === "SOLD") return "text-zinc-500";
  if (status === "CANCELLED" || status === "EXPIRED") return "text-red-600 dark:text-red-400";
  return "text-amber-600 dark:text-amber-400";
}

export default function LandBankingSection({ cooperativeId }: { cooperativeId: string }) {
  const [parcels, setParcels] = useState<LandParcel[]>([]);
  const [groups, setGroups] = useState<ContributionGroup[]>([]);
  const [expandedParcelId, setExpandedParcelId] = useState<string | null>(null);
  const [reservations, setReservations] = useState<ParcelReservation[]>([]);
  const [reservationDetails, setReservationDetails] = useState<Record<string, ParcelReservation>>({});
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [verificationScoreDraft, setVerificationScoreDraft] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const [location, setLocation] = useState("");
  const [priceNaira, setPriceNaira] = useState("");
  const [coordinatesMinna, setCoordinatesMinna] = useState("");
  const [coordinatesWgs84, setCoordinatesWgs84] = useState("");
  const [titleStatus, setTitleStatus] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    api.listLandParcels(cooperativeId).then(setParcels).catch(() => {});
    api.listContributionGroups(cooperativeId).then(setGroups).catch(() => {});
  }, [cooperativeId]);

  async function onToggleExpand(parcel: LandParcel) {
    setActionError(null);
    if (expandedParcelId === parcel.id) {
      setExpandedParcelId(null);
      return;
    }
    setExpandedParcelId(parcel.id);
    setVerificationScoreDraft(String(parcel.verificationScore));
    try {
      const [list] = await Promise.all([
        api.listReservationsForParcel(cooperativeId, parcel.id),
        api.listContributionGroups(cooperativeId).then(setGroups),
      ]);
      setReservations(list);
      const details = await Promise.all(list.map((r) => api.getReservation(cooperativeId, r.id)));
      setReservationDetails(Object.fromEntries(details.map((d) => [d.id, d])));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onCreateParcel(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    try {
      await api.createLandParcel(cooperativeId, {
        location,
        priceNaira: Number(priceNaira),
        coordinatesMinna: coordinatesMinna || undefined,
        coordinatesWgs84: coordinatesWgs84 || undefined,
        titleStatus: titleStatus || undefined,
      });
      setLocation("");
      setPriceNaira("");
      setCoordinatesMinna("");
      setCoordinatesWgs84("");
      setTitleStatus("");
      setParcels(await api.listLandParcels(cooperativeId));
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onSetVerificationScore(parcelId: string) {
    setActionError(null);
    try {
      await api.updateLandParcel(cooperativeId, parcelId, {
        verificationScore: Number(verificationScoreDraft),
      });
      setParcels(await api.listLandParcels(cooperativeId));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onPublish(parcelId: string) {
    setActionError(null);
    try {
      await api.publishLandParcel(cooperativeId, parcelId);
      setParcels(await api.listLandParcels(cooperativeId));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onReserve(parcelId: string) {
    setActionError(null);
    if (!selectedGroupId) {
      setActionError("Choose a group first");
      return;
    }
    try {
      await api.reserveParcel(cooperativeId, parcelId, selectedGroupId);
      setParcels(await api.listLandParcels(cooperativeId));
      const list = await api.listReservationsForParcel(cooperativeId, parcelId);
      setReservations(list);
      const details = await Promise.all(list.map((r) => api.getReservation(cooperativeId, r.id)));
      setReservationDetails(Object.fromEntries(details.map((d) => [d.id, d])));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onConfirmReservation(reservationId: string, parcelId: string) {
    setActionError(null);
    try {
      await api.confirmReservation(cooperativeId, reservationId);
      const list = await api.listReservationsForParcel(cooperativeId, parcelId);
      setReservations(list);
      const details = await Promise.all(list.map((r) => api.getReservation(cooperativeId, r.id)));
      setReservationDetails(Object.fromEntries(details.map((d) => [d.id, d])));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onCancelReservation(reservationId: string, parcelId: string) {
    setActionError(null);
    try {
      await api.cancelReservation(cooperativeId, reservationId);
      setParcels(await api.listLandParcels(cooperativeId));
      setReservations(await api.listReservationsForParcel(cooperativeId, parcelId));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onInitiateSyndication(reservationId: string) {
    setActionError(null);
    try {
      await api.initiateSyndication(cooperativeId, reservationId);
      setActionError(null);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
      <h2 className="font-semibold text-black dark:text-zinc-50">Land banking</h2>
      <ErrorText message={actionError} />
      <ul className="divide-y divide-black/[.08] dark:divide-white/[.145]">
        {parcels.map((p) => (
          <li key={p.id} className="space-y-3 py-3 text-sm">
            <button
              onClick={() => onToggleExpand(p)}
              className="flex w-full items-center justify-between text-left"
            >
              <span>
                <strong>{p.location}</strong>{" "}
                <span className="text-xs text-zinc-500">
                  (₦{p.priceNaira} · score {p.verificationScore})
                </span>
              </span>
              <span className={`text-xs ${statusColor(p.status)}`}>{p.status}</span>
            </button>

            {expandedParcelId === p.id && (
              <div className="space-y-4 rounded-lg bg-zinc-50 p-4 dark:bg-black/40">
                {p.titleStatus && <p className="text-xs text-zinc-500">Title: {p.titleStatus}</p>}
                {p.coordinatesMinna && (
                  <p className="text-xs text-zinc-500">
                    Minna: {p.coordinatesMinna} · WGS84: {p.coordinatesWgs84}
                  </p>
                )}

                {p.status === "UNDER_REVIEW" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      className="w-24 rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-xs dark:border-white/[.145]"
                      placeholder="Score 0-100"
                      value={verificationScoreDraft}
                      onChange={(e) => setVerificationScoreDraft(e.target.value)}
                    />
                    <button
                      onClick={() => onSetVerificationScore(p.id)}
                      className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium dark:border-white/[.145]"
                    >
                      Set score
                    </button>
                    <button
                      onClick={() => onPublish(p.id)}
                      className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium dark:border-white/[.145]"
                    >
                      Publish
                    </button>
                  </div>
                )}

                {p.status === "PUBLISHED" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      className="rounded-md border border-black/[.08] bg-white dark:bg-zinc-900 px-2 py-1 text-xs dark:border-white/[.145]"
                      value={selectedGroupId}
                      onChange={(e) => setSelectedGroupId(e.target.value)}
                    >
                      <option value="">Choose a group…</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => onReserve(p.id)}
                      className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium dark:border-white/[.145]"
                    >
                      Reserve for group
                    </button>
                  </div>
                )}

                {reservations.length > 0 && (
                  <div>
                    <h3 className="mb-1 text-xs font-semibold uppercase text-zinc-500">Reservations</h3>
                    <ul className="space-y-2 text-xs">
                      {reservations.map((r) => {
                        const detail = reservationDetails[r.id];
                        return (
                          <li key={r.id} className="space-y-1">
                            <div className="flex items-center justify-between">
                              <span>{r.group?.name}</span>
                              <span className={statusColor(r.status)}>{r.status}</span>
                            </div>
                            {detail && (
                              <div className="text-zinc-500">
                                Saved ₦{detail.savedTotal} of ₦{detail.targetPrice}
                              </div>
                            )}
                            {r.status === "ACTIVE" && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => onConfirmReservation(r.id, p.id)}
                                  className="rounded-full border border-black/[.08] px-2 py-0.5 dark:border-white/[.145]"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => onCancelReservation(r.id, p.id)}
                                  className="text-red-600 hover:underline dark:text-red-400"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                            {r.status === "CONFIRMED" && (
                              <button
                                onClick={() => onInitiateSyndication(r.id)}
                                className="rounded-full border border-black/[.08] px-2 py-0.5 dark:border-white/[.145]"
                              >
                                Initiate syndication
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
        {parcels.length === 0 && <li className="py-3 text-sm text-zinc-500">No land parcels listed yet.</li>}
      </ul>

      <form onSubmit={onCreateParcel} className="space-y-2 border-t border-black/[.08] pt-3 dark:border-white/[.145]">
        <ErrorText message={createError} />
        <div className="flex flex-wrap gap-2">
          <input
            className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            required
          />
          <input
            className="w-32 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Price (₦)"
            value={priceNaira}
            onChange={(e) => setPriceNaira(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Minna Datum coordinates"
            value={coordinatesMinna}
            onChange={(e) => setCoordinatesMinna(e.target.value)}
          />
          <input
            className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="WGS84 coordinates"
            value={coordinatesWgs84}
            onChange={(e) => setCoordinatesWgs84(e.target.value)}
          />
        </div>
        <input
          className="w-full rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
          placeholder="Title status / registry notes"
          value={titleStatus}
          onChange={(e) => setTitleStatus(e.target.value)}
        />
        <button
          type="submit"
          className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
        >
          List parcel (under review)
        </button>
      </form>
    </section>
  );
}

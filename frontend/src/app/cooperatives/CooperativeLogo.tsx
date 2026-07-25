"use client";

import { useEffect, useState } from "react";
import { downloadFile } from "@/lib/api";

export default function CooperativeLogo({
  cooperativeId,
  hasLogo,
  name,
  size = 32,
}: {
  cooperativeId: string;
  hasLogo: boolean;
  name: string;
  size?: number;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!hasLogo) {
      return;
    }
    let objectUrl: string | null = null;
    downloadFile(`/cooperatives/${cooperativeId}/logo`)
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setUrl(null));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [cooperativeId, hasLogo]);

  if (!url) {
    return (
      <div
        style={{ width: size, height: size }}
        className="shrink-0 rounded-md border border-dashed border-black/[.15] dark:border-white/[.2]"
      />
    );
  }

  // eslint-disable-next-line @next/next/no-img-element -- authenticated blob URL, not a static asset
  return <img src={url} alt={`${name} logo`} style={{ width: size, height: size }} className="shrink-0 rounded-md object-cover" />;
}

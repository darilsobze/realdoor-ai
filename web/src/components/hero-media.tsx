// Hero background media with graceful degradation: video → poster → gradient.
// Reads /hero.mp4 and /hero-poster.png from web/public. If the video is absent
// or errors (Vite serves the SPA fallback for a missing file, which fails to
// decode → onError), we fall back to the poster; if the poster is absent too,
// a calm gradient in our palette shows. prefers-reduced-motion never plays the
// video. A soft cream scrim over everything keeps the dark ink hero text at AA.
import { useState } from "react";
import { usePrefersReducedMotion } from "@/lib/motion";

export function HeroMedia() {
  const reduced = usePrefersReducedMotion();
  const [videoFailed, setVideoFailed] = useState(false);
  const [posterFailed, setPosterFailed] = useState(false);
  const showVideo = !reduced && !videoFailed;

  return (
    <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
      {/* Gradient base — a deep navy, so the white hero text stays AA even when
          poster + video are both missing. */}
      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(155deg, #24304d 0%, #141d33 55%, #0e1526 100%)" }}
      />

      {/* Poster — hidden if it fails to load, revealing the gradient. */}
      {!posterFailed && (
        <img
          src="/hero-poster.png"
          alt=""
          onError={() => setPosterFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      )}

      {/* Video — covers the poster when it can play; errors fall back to poster. */}
      {showVideo && (
        <video
          src="/hero.mp4"
          poster="/hero-poster.png"
          muted
          autoPlay
          loop
          playsInline
          preload="metadata"
          onError={() => setVideoFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      )}

      {/* Dark scrim: keeps white hero text at AA over the (bright, warm) media,
          with a stronger pool behind the centered text and a darker foot for the
          eligibility band, while the scene still shows through the edges. */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/25 to-black/65" />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(60% 55% at 50% 44%, rgba(8,12,22,0.42), transparent 78%)" }}
      />
    </div>
  );
}

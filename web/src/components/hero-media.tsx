// Hero background media with graceful degradation: video → poster → gradient.
// Reads /hero.mp4 and /hero-poster.jpg from web/public. If the video is absent
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
      {/* Gradient base — always present, shows if poster + video are missing. */}
      <div className="absolute inset-0 bg-gradient-to-br from-accent via-background to-secondary" />

      {/* Poster — hidden if it fails to load, revealing the gradient. */}
      {!posterFailed && (
        <img
          src="/hero-poster.jpg"
          alt=""
          onError={() => setPosterFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      )}

      {/* Video — covers the poster when it can play; errors fall back to poster. */}
      {showVideo && (
        <video
          src="/hero.mp4"
          poster="/hero-poster.jpg"
          muted
          autoPlay
          loop
          playsInline
          preload="metadata"
          onError={() => setVideoFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      )}

      {/* Soft scrim: a moderate overall wash keeps AA and lets the (bright,
          warm) media show, plus a stronger pool behind the centered text so
          dark ink text stays readable regardless of the frame beneath it. */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "color-mix(in oklch, var(--background) 45%, transparent)" }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(62% 55% at 50% 46%, color-mix(in oklch, var(--background) 58%, transparent), transparent 78%)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-background/20 via-transparent to-background/45" />
    </div>
  );
}

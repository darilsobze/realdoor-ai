// The packet preview as a floating 3D page gallery. Six paper-like cards
// (one per buildPacketSections() section) ride a slowly rotating ring; hover,
// focus, drag, wheel, or arrow keys pause the spin and bring a card to front.
// Clicking/Enter expands a card into a full-size dialog. Each card can be
// collected into the bottom-right packet target (drag the grip, or the
// keyboard/touch-friendly "Add to packet" button). Under prefers-reduced-motion
// the ring becomes a flat snap-scroll row with identical functionality.
//
// Motion is imperative: a single rAF writes only transform/opacity/filter on
// refs (no per-frame React render), so it stays compositor-bound at 60fps.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  FolderCheck,
  GripVertical,
  Maximize2,
  Minus,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PaperPage } from "@/components/paper-page";
import { usePrefersReducedMotion } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { StatusVariant } from "@/components/status-badge";
import type { PacketSection } from "@/engine";

const CARD_W = 260;
const CARD_H = 366;
const RADIUS = 340;
const IDLE_DEG_PER_SEC = 18; // ~20s per revolution
const ENGAGE_MS = 3500; // touch: hold on a card this long after an interaction

interface PacketGalleryProps {
  sections: PacketSection[];
  /** Status variant per Checklist line (aligned to that section's lines). */
  checklistStatuses: StatusVariant[];
  collected: Set<string>;
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}

export function PacketGallery({
  sections,
  checklistStatuses,
  collected,
  onAdd,
  onRemove,
}: PacketGalleryProps) {
  const reduced = usePrefersReducedMotion();
  const n = sections.length;
  const step = 360 / n;

  const statusesFor = useCallback(
    (name: string) => (name === "Checklist" ? checklistStatuses : undefined),
    [checklistStatuses],
  );

  const [current, setCurrent] = useState(0);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [listOpen, setListOpen] = useState(false);
  const [pulse, setPulse] = useState(false);

  const targetRef = useRef<HTMLButtonElement>(null);
  const collectedCount = collected.size;

  // Pulse the target once when the last section lands.
  const prevCount = useRef(collectedCount);
  useEffect(() => {
    if (collectedCount === n && prevCount.current < n) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 700);
      prevCount.current = collectedCount;
      return () => clearTimeout(t);
    }
    prevCount.current = collectedCount;
  }, [collectedCount, n]);

  return (
    <div className="relative">
      {reduced ? (
        <FlatRow
          sections={sections}
          statusesFor={statusesFor}
          collected={collected}
          onAdd={onAdd}
          onRemove={onRemove}
          onExpand={setExpanded}
          onCurrent={setCurrent}
          current={current}
        />
      ) : (
        <Ring
          sections={sections}
          statusesFor={statusesFor}
          collected={collected}
          onAdd={onAdd}
          onRemove={onRemove}
          onExpand={setExpanded}
          onCurrent={setCurrent}
          step={step}
          targetRef={targetRef}
        />
      )}

      {/* aria-live page position (both modes). */}
      <p aria-live="polite" className="sr-only">
        {`Page ${current + 1} of ${n}: ${sections[current]?.name ?? ""}`}
      </p>

      {/* Collect target — fixed above the download bar; drop here or use each
          card's Add button. */}
      <div className="pointer-events-none fixed bottom-24 right-6 z-30">
        <button
          ref={targetRef}
          type="button"
          data-collect-target
          onClick={() => setListOpen(true)}
          className={cn(
            "pointer-events-auto inline-flex items-center gap-2 rounded-full border bg-card px-4 py-2.5 text-sm font-medium text-ink shadow-lg transition-transform",
            pulse && "animate-value-pulse scale-105",
          )}
          aria-label={`Packet folder — ${collectedCount} of ${n} sections collected. Open list.`}
        >
          <FolderCheck aria-hidden="true" className={cn("size-5", collectedCount === n ? "text-status-confirmed" : "text-primary")} />
          <span className="tnum">{collectedCount}/{n}</span>
          <span className="text-subtle">collected</span>
        </button>
      </div>

      {/* Collected list — remove sections (drag-out equivalent). */}
      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Sections in your packet ({collectedCount}/{n})</DialogTitle>
          </DialogHeader>
          <ul className="flex flex-col gap-1.5">
            {sections.map((s) => {
              const isIn = collected.has(s.name);
              return (
                <li key={s.name} className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
                  <span className="flex items-center gap-2 text-sm text-ink">
                    {isIn ? (
                      <Check aria-hidden="true" className="size-4 text-status-confirmed" />
                    ) : (
                      <Minus aria-hidden="true" className="size-4 text-subtle" />
                    )}
                    {s.name}
                  </span>
                  <Button
                    size="sm"
                    variant={isIn ? "outline" : "default"}
                    onClick={() => (isIn ? onRemove(s.name) : onAdd(s.name))}
                  >
                    {isIn ? "Remove" : "Add"}
                  </Button>
                </li>
              );
            })}
          </ul>
        </DialogContent>
      </Dialog>

      {/* Expanded full-size preview. */}
      <Dialog open={expanded !== null} onOpenChange={(o) => !o && setExpanded(null)}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-hidden p-0">
          {expanded !== null && sections[expanded] && (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>{sections[expanded].name} — full preview</DialogTitle>
              </DialogHeader>
              <div className="max-h-[88vh] overflow-y-auto p-2">
                <PaperPage
                  section={sections[expanded]}
                  statuses={statusesFor(sections[expanded].name)}
                  pageNumber={expanded + 1}
                  pageCount={n}
                />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------------ Ring --- */

interface RingProps {
  sections: PacketSection[];
  statusesFor: (name: string) => StatusVariant[] | undefined;
  collected: Set<string>;
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  onExpand: (i: number) => void;
  onCurrent: (i: number) => void;
  step: number;
  targetRef: React.RefObject<HTMLButtonElement | null>;
}

function Ring({
  sections,
  statusesFor,
  collected,
  onAdd,
  onRemove,
  onExpand,
  onCurrent,
  step,
  targetRef,
}: RingProps) {
  const n = sections.length;
  const ringRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Motion state kept in refs so the rAF never triggers a React render.
  const angle = useRef(0);
  const vel = useRef(0);
  const snapTarget = useRef<number | null>(null);
  const dragging = useRef(false);
  const hover = useRef(false);
  const focusWithin = useRef(false);
  const engagedUntil = useRef(0);
  const dragStartX = useRef(0);
  const dragStartAngle = useRef(0);
  const lastMoveX = useRef(0);
  const lastMoveT = useRef(0);
  const frontIndex = useRef(0);

  // Ghost drag (drag-to-collect).
  const [ghost, setGhost] = useState<{ i: number; x: number; y: number; landing: boolean } | null>(null);
  const ghostRef = useRef(ghost);
  ghostRef.current = ghost;

  const bringToFront = useCallback(
    (i: number) => {
      const desired = -i * step;
      // Choose the equivalent angle nearest the current one (no long unwind).
      const a = angle.current;
      const k = Math.round((a - desired) / 360);
      snapTarget.current = desired + k * 360;
      vel.current = 0;
      engagedUntil.current = performance.now() + ENGAGE_MS;
    },
    [step],
  );

  useEffect(() => {
    let raf = 0;
    let lastTs = performance.now();
    const apply = () => {
      const a = angle.current;
      if (ringRef.current) ringRef.current.style.transform = `translateZ(-${RADIUS}px) rotateY(${a}deg)`;
      let front = 0;
      let bestCos = -Infinity;
      for (let i = 0; i < n; i++) {
        const rel = ((a + i * step) % 360 + 540) % 360 - 180; // [-180,180]
        const cos = Math.cos((rel * Math.PI) / 180);
        const facing = (cos + 1) / 2; // 0 back .. 1 front
        const el = cardRefs.current[i];
        if (el) {
          el.style.opacity = String(0.1 + 0.9 * Math.pow(facing, 1.4));
          el.style.filter = facing > 0.98 ? "none" : `blur(${((1 - facing) * 4).toFixed(2)}px)`;
          el.style.pointerEvents = cos > -0.1 ? "auto" : "none";
          el.style.zIndex = String(Math.round(facing * 100));
        }
        if (cos > bestCos) {
          bestCos = cos;
          front = i;
        }
      }
      if (front !== frontIndex.current) {
        frontIndex.current = front;
        onCurrent(front);
      }
    };

    const frame = (ts: number) => {
      const dt = ts - lastTs;
      lastTs = ts;
      const engaged = ts < engagedUntil.current;
      const paused = hover.current || focusWithin.current || dragging.current || engaged;
      if (dragging.current) {
        // angle set by pointermove
      } else if (Math.abs(vel.current) > 0.02) {
        angle.current += vel.current;
        vel.current *= 0.94;
        if (Math.abs(vel.current) <= 0.02) snapTarget.current = Math.round(angle.current / step) * step;
      } else if (snapTarget.current !== null) {
        angle.current += (snapTarget.current - angle.current) * 0.2;
        if (Math.abs(snapTarget.current - angle.current) < 0.05) {
          angle.current = snapTarget.current;
          snapTarget.current = null;
        }
      } else if (paused) {
        const t = Math.round(angle.current / step) * step;
        angle.current += (t - angle.current) * 0.2;
      } else {
        angle.current -= (IDLE_DEG_PER_SEC * dt) / 1000;
      }
      apply();
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [n, step, onCurrent]);

  /* --- stage rotation drag --- */
  const onStagePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    dragging.current = true;
    dragStartX.current = e.clientX;
    dragStartAngle.current = angle.current;
    lastMoveX.current = e.clientX;
    lastMoveT.current = performance.now();
    vel.current = 0;
    snapTarget.current = null;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onStagePointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - dragStartX.current;
    angle.current = dragStartAngle.current + dx * 0.3;
    const now = performance.now();
    const dt = now - lastMoveT.current || 16;
    vel.current = ((e.clientX - lastMoveX.current) * 0.3 * 16) / dt;
    lastMoveX.current = e.clientX;
    lastMoveT.current = now;
  };
  const onStagePointerUp = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    engagedUntil.current = performance.now() + ENGAGE_MS;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    angle.current += d * 0.15;
    vel.current = 0;
    snapTarget.current = null;
    engagedUntil.current = performance.now() + ENGAGE_MS;
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      const i = (frontIndex.current - 1 + n) % n;
      bringToFront(i);
      focusCardButton(i);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      const i = (frontIndex.current + 1) % n;
      bringToFront(i);
      focusCardButton(i);
    }
  };

  const focusCardButton = (i: number) => {
    const el = cardRefs.current[i]?.querySelector<HTMLButtonElement>("[data-card-add]");
    el?.focus();
  };

  /* --- ghost drag to the collect target --- */
  const onGripPointerDown = (i: number) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    setGhost({ i, x: e.clientX, y: e.clientY, landing: false });
  };
  const onGripPointerMove = (e: React.PointerEvent) => {
    if (!ghostRef.current || ghostRef.current.landing) return;
    setGhost((g) => (g ? { ...g, x: e.clientX, y: e.clientY } : g));
  };
  const onGripPointerUp = (i: number) => (e: React.PointerEvent) => {
    const g = ghostRef.current;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (!g) return;
    const rect = targetRef.current?.getBoundingClientRect();
    const hit =
      rect && e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
    if (hit && rect) {
      // Animate the ghost shrinking into the target, then collect.
      setGhost({ ...g, x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, landing: true });
      setTimeout(() => {
        onAdd(sections[i].name);
        setGhost(null);
      }, 260);
    } else {
      setGhost(null);
    }
  };

  return (
    <div
      className="relative select-none"
      style={{ perspective: "900px", perspectiveOrigin: "50% 44%" }}
      role="group"
      aria-label={`Packet pages — ${n} sections, ${collected.size} collected. Use arrow keys to turn the ring.`}
      onKeyDown={onKeyDown}
      onMouseEnter={() => (hover.current = true)}
      onMouseLeave={() => (hover.current = false)}
      onFocusCapture={() => (focusWithin.current = true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) focusWithin.current = false;
      }}
    >
      {/* radial-gradient backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(60% 55% at 50% 42%, color-mix(in oklch, var(--accent), transparent 25%), transparent 72%)",
        }}
      />
      <div
        className="relative mx-auto flex touch-pan-y items-center justify-center overflow-hidden"
        style={{ height: 460 }}
        onPointerDown={onStagePointerDown}
        onPointerMove={onStagePointerMove}
        onPointerUp={onStagePointerUp}
        onPointerCancel={onStagePointerUp}
        onWheel={onWheel}
      >
        <div
          ref={ringRef}
          className="relative"
          style={{ transformStyle: "preserve-3d", width: CARD_W, height: CARD_H }}
        >
          {sections.map((section, i) => (
            <div
              key={section.name}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              onFocusCapture={() => bringToFront(i)}
              className="absolute left-1/2 top-1/2 flex flex-col drop-shadow-xl"
              style={{
                width: CARD_W,
                height: CARD_H,
                marginLeft: -CARD_W / 2,
                marginTop: -CARD_H / 2,
                transform: `rotateY(${i * step}deg) translateZ(${RADIUS}px)`,
                backfaceVisibility: "hidden",
              }}
            >
              <CardActions
                section={section}
                statuses={statusesFor(section.name)}
                index={i}
                total={n}
                collected={collected.has(section.name)}
                onAdd={() => onAdd(section.name)}
                onRemove={() => onRemove(section.name)}
                onExpand={() => onExpand(i)}
                onGripDown={onGripPointerDown(i)}
                onGripMove={onGripPointerMove}
                onGripUp={onGripPointerUp(i)}
                dragging={ghost?.i === i && !ghost.landing}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Drag ghost (a flat 2D proxy that ignores the 3D transform). */}
      {ghost && (
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none fixed z-50 transition-[transform,opacity] duration-200 ease-out",
            ghost.landing && "opacity-0",
          )}
          style={{
            left: ghost.x,
            top: ghost.y,
            width: CARD_W * 0.6,
            height: CARD_H * 0.6,
            transform: `translate(-50%, -50%) ${ghost.landing ? "scale(0.1)" : "scale(0.7) rotate(-4deg)"}`,
          }}
        >
          <PaperPage
            section={sections[ghost.i]}
            statuses={statusesFor(sections[ghost.i].name)}
            pageNumber={ghost.i + 1}
            pageCount={n}
            dense
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------- Flat row --- */

function FlatRow({
  sections,
  statusesFor,
  collected,
  onAdd,
  onRemove,
  onExpand,
  onCurrent,
  current,
}: {
  sections: PacketSection[];
  statusesFor: (name: string) => StatusVariant[] | undefined;
  collected: Set<string>;
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  onExpand: (i: number) => void;
  onCurrent: (i: number) => void;
  current: number;
}) {
  const n = sections.length;
  const scroller = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  const goTo = (i: number) => {
    const clamped = Math.max(0, Math.min(n - 1, i));
    itemRefs.current[clamped]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    onCurrent(clamped);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      goTo(current - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      goTo(current + 1);
    }
  };

  // Track the centered card as the user scrolls.
  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const mid = el.scrollLeft + el.clientWidth / 2;
        let best = 0;
        let bestD = Infinity;
        itemRefs.current.forEach((c, i) => {
          if (!c) return;
          const center = c.offsetLeft + c.offsetWidth / 2;
          const d = Math.abs(center - mid);
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        });
        onCurrent(best);
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [onCurrent]);

  return (
    <div
      role="group"
      aria-label={`Packet pages — ${n} sections, ${collected.size} collected. Use arrow keys to move between pages.`}
      onKeyDown={onKeyDown}
    >
      <div
        ref={scroller}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto rounded-2xl bg-accent/40 p-4"
        style={{ scrollbarWidth: "thin" }}
      >
        {sections.map((section, i) => (
          <div
            key={section.name}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            className="flex shrink-0 snap-center flex-col drop-shadow-md"
            style={{ width: CARD_W, height: CARD_H }}
          >
            <CardActions
              section={section}
              statuses={statusesFor(section.name)}
              index={i}
              total={n}
              collected={collected.has(section.name)}
              onAdd={() => onAdd(section.name)}
              onRemove={() => onRemove(section.name)}
              onExpand={() => onExpand(i)}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-center gap-2 text-xs text-subtle">
        <button type="button" onClick={() => goTo(current - 1)} className="rounded-md px-2 py-1 hover:text-primary" aria-label="Previous page">
          ‹ Prev
        </button>
        <span className="tnum">Page {current + 1} of {n}</span>
        <button type="button" onClick={() => goTo(current + 1)} className="rounded-md px-2 py-1 hover:text-primary" aria-label="Next page">
          Next ›
        </button>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- Card + actions --- */

function CardActions({
  section,
  statuses,
  index,
  total,
  collected,
  onAdd,
  onRemove,
  onExpand,
  onGripDown,
  onGripMove,
  onGripUp,
  dragging,
}: {
  section: PacketSection;
  statuses?: StatusVariant[];
  index: number;
  total: number;
  collected: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onExpand: () => void;
  onGripDown?: (e: React.PointerEvent) => void;
  onGripMove?: (e: React.PointerEvent) => void;
  onGripUp?: (e: React.PointerEvent) => void;
  dragging?: boolean;
}) {
  return (
    <div className={cn("relative flex h-full flex-col transition-opacity", dragging && "opacity-30")}>
      {onGripDown && (
        <button
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onPointerDown={onGripDown}
          onPointerMove={onGripMove}
          onPointerUp={onGripUp}
          className="absolute right-1.5 top-1.5 z-10 cursor-grab touch-none rounded-md bg-card/70 p-1 text-subtle backdrop-blur hover:text-primary active:cursor-grabbing"
          title="Drag to add to packet"
        >
          <GripVertical className="size-4" />
        </button>
      )}
      <button
        type="button"
        onClick={onExpand}
        className="min-h-0 flex-1 rounded-xl text-left focus-visible:outline-2"
        aria-label={`Expand page ${index + 1} of ${total}: ${section.name}`}
      >
        <PaperPage section={section} statuses={statuses} pageNumber={index + 1} pageCount={total} dense />
      </button>
      <div className="mt-2 flex items-center gap-1.5">
        <Button
          type="button"
          size="sm"
          data-card-add
          variant={collected ? "outline" : "default"}
          className="flex-1"
          onClick={collected ? onRemove : onAdd}
          aria-pressed={collected}
        >
          {collected ? (
            <>
              <Check aria-hidden="true" className="fill-none" />
              Added
            </>
          ) : (
            <>
              <Plus aria-hidden="true" />
              Add to packet
            </>
          )}
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" onClick={onExpand} aria-label={`Expand ${section.name}`}>
          <Maximize2 aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
}

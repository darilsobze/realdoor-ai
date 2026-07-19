// App-wide top navigation: persistent, sticky, white surface. Left wordmark,
// center section tabs as a segmented control (roving-tabindex, arrow-key
// navigable, aria-current on the active section), right session actions.
// Below md the tabs collapse into a dropdown menu (keeps the bar within the
// viewport at 200% zoom / narrow widths).
import { useRef } from "react";
import { DoorOpen, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DeleteEverything } from "@/components/delete-everything";
import { cn } from "@/lib/utils";
import { useReview } from "@/store/review";

interface Section {
  id: string;
  label: string;
  hash: string;
  /** Needs an uploaded document to be meaningful. */
  needsSession: boolean;
}

const SECTIONS: Section[] = [
  { id: "profile", label: "Profile", hash: "#/review", needsSession: true },
  { id: "understand", label: "Understand", hash: "#/understand", needsSession: false },
  { id: "prepare", label: "Prepare", hash: "#/packet", needsSession: true },
  { id: "safety", label: "Safety", hash: "#/safety", needsSession: false },
];

function activeHashFor(hash: string): string {
  // Upload has no active tab.
  return SECTIONS.some((s) => s.hash === hash) ? hash : "";
}

export function AppNav({ hash }: { hash: string }) {
  const { state } = useReview();
  const hasSession = state.sessionId !== null;
  const active = activeHashFor(hash);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  const enabled = SECTIONS.filter((s) => !s.needsSession || hasSession);

  // Roving-tabindex arrow-key navigation over the enabled tabs.
  function onKeyDown(e: React.KeyboardEvent, index: number) {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    const last = enabled.length - 1;
    let next = index;
    if (e.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (e.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    tabRefs.current[next]?.focus();
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-6">
        <a
          href="#/"
          className="flex shrink-0 items-center gap-2 rounded-md text-base font-semibold text-ink"
        >
          <DoorOpen aria-hidden="true" className="size-5 text-primary" />
          RealDoor
        </a>

        {/* Center tabs — segmented control (md+). */}
        <nav aria-label="Sections" className="hidden md:block">
          <ul className="flex items-center gap-1 rounded-lg bg-muted p-1">
            {enabled.map((s, i) => {
              const isActive = s.hash === active;
              return (
                <li key={s.id}>
                  <a
                    ref={(el) => { tabRefs.current[i] = el; }}
                    href={s.hash}
                    aria-current={isActive ? "page" : undefined}
                    tabIndex={isActive || (!active && i === 0) ? 0 : -1}
                    onKeyDown={(e) => onKeyDown(e, i)}
                    className={cn(
                      "inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                      isActive
                        ? "bg-accent text-primary shadow-sm"
                        : "text-subtle hover:text-ink",
                    )}
                  >
                    {s.label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-1">
          {/* Compact menu (below md). */}
          <div className="md:hidden">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" aria-label="Open sections menu">
                  <Menu aria-hidden="true" className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {enabled.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    aria-current={s.hash === active ? "page" : undefined}
                    onSelect={() => { window.location.hash = s.hash; }}
                    className={cn(s.hash === active && "text-primary")}
                  >
                    {s.label}
                  </DropdownMenuItem>
                ))}
                {hasSession && (
                  <DropdownMenuItem onSelect={() => { window.location.hash = "#/"; }}>
                    Upload another document
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {hasSession && (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="hidden md:inline-flex"
                onClick={() => { window.location.hash = "#/"; }}
              >
                Upload another document
              </Button>
              <DeleteEverything />
            </>
          )}
        </div>
      </div>
    </header>
  );
}

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { AlertTriangle, ShieldCheck, Trash2 } from "lucide-react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SessionProvider, useSession } from "@/state/session";
import { AnnouncerProvider, useAnnouncer } from "@/state/announcer";
import { StepProgress } from "@/components/step-progress";
import { Button } from "@/components/ui/button";
import { deleteSession as deleteBackendSession } from "@/api/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

function NotFoundComponent() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong. You can try again or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "RealDoor — Application-Readiness Copilot" },
      {
        name: "description",
        content:
          "A renter-side copilot that helps you understand your documents, published program rules, and remaining application tasks. It assists preparation; it never decides eligibility.",
      },
      { name: "author", content: "RealDoor" },
      { property: "og:title", content: "RealDoor — Application-Readiness Copilot" },
      {
        property: "og:description",
        content:
          "Turn synthetic household documents into a human-confirmed profile with authoritative citations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "preconnect",
        href: "https://fonts.googleapis.com",
      },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <SessionProvider>
        <AnnouncerProvider>
          <AppShell />
        </AnnouncerProvider>
      </SessionProvider>
    </QueryClientProvider>
  );
}

function AppShell() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isLanding = path === "/";
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <SessionBanner />
      <TopBar showDelete={!isLanding} />
      {!isLanding && <StepProgress />}
      <main id="main" className="flex-1">
        <div key={path} className="animate-fade-in">
          <Outlet />
        </div>
      </main>
      {!isLanding && <SiteFooter />}
    </div>
  );
}

function TopBar({ showDelete }: { showDelete: boolean }) {
  return (
    <header role="banner" className="border-b border-border bg-card">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
        <Link
          to="/"
          aria-label="RealDoor Copilot — home"
          className="flex items-center gap-2 font-semibold text-foreground rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span
            aria-hidden="true"
            className="grid size-8 place-items-center rounded-md bg-primary text-primary-foreground"
          >
            <ShieldCheck className="size-4" />
          </span>
          <span>
            RealDoor <span className="text-muted-foreground">· Copilot</span>
          </span>
        </Link>
        {showDelete && (
          <nav aria-label="Primary" className="flex items-center gap-1 text-sm">
            <DeleteSessionButton />
          </nav>
        )}
      </div>
    </header>
  );
}

function SessionBanner() {
  const { state } = useSession();
  const injCount = state.injections.length;
  const isDemo = state.mode === "demo";
  return (
    <div
      role="region"
      aria-label="Session notice"
      className="border-b border-border bg-status-info px-4 py-2 text-sm text-status-info-foreground"
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2">
          <AlertTriangle aria-hidden="true" className="size-4" />
          <span>
            {isDemo ? (
              <>
                <strong>Safety demo session.</strong> Synthetic data only. Nothing is submitted or
                shared.
              </>
            ) : (
              <>
                <strong>Session in progress.</strong> Synthetic files are processed by the RealDoor
                server and configured extraction provider. Nothing is submitted to a property.
              </>
            )}
          </span>
        </p>
        {injCount > 0 && (
          <p className="text-xs">
            {injCount} prompt-injection attempt{injCount === 1 ? "" : "s"} in uploaded documents
            were detected and ignored.
          </p>
        )}
      </div>
    </div>
  );
}

function DeleteSessionButton() {
  const { state, reset } = useSession();
  const { announce } = useAnnouncer();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function deleteSession() {
    setDeleting(true);
    setError("");
    try {
      if (state.mode !== "demo" && state.backendSessionId) {
        await deleteBackendSession(state.backendSessionId);
      }
      reset();
      setOpen(false);
      announce("Session deleted. All documents and confirmed values cleared.");
      router.navigate({ to: "/" });
    } catch {
      setError("Server deletion was not confirmed. Please try again before leaving this session.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          aria-label="Delete this session"
          className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Trash2 aria-hidden="true" className="size-4" />
          Delete session
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this session?</AlertDialogTitle>
          <AlertDialogDescription>
            {state.mode === "demo"
              ? "This clears the local safety-demo session."
              : "This deletes uploaded documents and derived data from the RealDoor server, then clears this browser session."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-status-danger-foreground">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>Keep session</AlertDialogCancel>
          <AlertDialogAction
            disabled={deleting}
            onClick={(event) => {
              event.preventDefault();
              void deleteSession();
            }}
          >
            {deleting ? "Deleting…" : "Delete session"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted-foreground">
        <p>
          RealDoor is a preparation copilot. It never decides eligibility, scores applications, or
          predicts acceptance. Normal mode uses the frozen 2026 corpus; safety-demo records are
          simulated and labeled.
        </p>
      </div>
    </footer>
  );
}

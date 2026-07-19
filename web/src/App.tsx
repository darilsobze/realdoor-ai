import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppNav } from "@/components/app-nav";
import { StyleGuide } from "@/ui/StyleGuide";
import { PacketPage } from "@/ui/PacketPage";
import { SafetyPanelPage } from "@/ui/SafetyPanelPage";
import { UnderstandPage } from "@/ui/UnderstandPage";
import { LandingPage } from "@/pages/LandingPage";
import { ReviewPage } from "@/pages/ReviewPage";
import { ReviewProvider } from "@/store/review";

function useHashRoute() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return hash;
}

export default function App() {
  const hash = useHashRoute();

  if (hash === "#/style-guide") {
    return (
      <ReviewProvider>
        <StyleGuide />
      </ReviewProvider>
    );
  }

  let screen;
  let onLanding = false;
  if (hash === "#/review") screen = <ReviewPage />;
  else if (hash === "#/understand") screen = <UnderstandPage />;
  else if (hash === "#/packet") screen = <PacketPage />;
  else if (hash === "#/safety") screen = <SafetyPanelPage />;
  else {
    screen = <LandingPage />;
    onLanding = true;
  }

  return (
    <ReviewProvider>
      <TooltipProvider delayDuration={200}>
        {/* Skip-link — first focusable element on the landing; jumps past the
            hero to the upload section without changing the route hash. */}
        {onLanding && (
          <a
            href="#application"
            onClick={(e) => {
              e.preventDefault();
              const el = document.getElementById("application");
              el?.scrollIntoView({ block: "start" });
              el?.focus({ preventScroll: true });
            }}
            className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:left-4 focus-visible:top-3 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-primary focus-visible:px-4 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-primary-foreground focus-visible:shadow-lg"
          >
            Skip to application
          </a>
        )}
        <AppNav hash={hash} />
        {screen}
        <Toaster position="bottom-right" duration={6000} />
      </TooltipProvider>
    </ReviewProvider>
  );
}

import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppNav } from "@/components/app-nav";
import { StyleGuide } from "@/ui/StyleGuide";
import { PacketPage } from "@/ui/PacketPage";
import { SafetyPanelPage } from "@/ui/SafetyPanelPage";
import { UnderstandPage } from "@/ui/UnderstandPage";
import { UploadPage } from "@/pages/UploadPage";
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
  if (hash === "#/review") screen = <ReviewPage />;
  else if (hash === "#/understand") screen = <UnderstandPage />;
  else if (hash === "#/packet") screen = <PacketPage />;
  else if (hash === "#/safety") screen = <SafetyPanelPage />;
  else screen = <UploadPage />;

  return (
    <ReviewProvider>
      <TooltipProvider delayDuration={200}>
        <AppNav hash={hash} />
        {screen}
        <Toaster position="bottom-right" duration={6000} />
      </TooltipProvider>
    </ReviewProvider>
  );
}

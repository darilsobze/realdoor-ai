import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
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

  let screen;
  if (hash === "#/style-guide") screen = <StyleGuide />;
  else if (hash === "#/review") screen = <ReviewPage />;
  else if (hash === "#/understand") screen = <UnderstandPage />;
  else if (hash === "#/packet") screen = <PacketPage />;
  else if (hash === "#/safety") screen = <SafetyPanelPage />;
  else screen = <UploadPage />;

  return (
    <ReviewProvider>
      {screen}
      <Toaster position="bottom-right" duration={6000} />
    </ReviewProvider>
  );
}

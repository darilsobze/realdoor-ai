import { useEffect, useState } from "react";
import { DoorOpen } from "lucide-react";
import { StyleGuide } from "@/ui/StyleGuide";

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
  if (hash === "#/style-guide") return <StyleGuide />;

  return (
    <main className="mx-auto flex max-w-(--container-reading) flex-col items-center gap-4 px-6 py-24 text-center">
      <DoorOpen aria-hidden="true" className="size-10 text-primary" />
      <h1 className="text-2xl">RealDoor</h1>
      <p className="max-w-md text-body">
        Get your rental application ready — with every value checked by you.
        The upload screen arrives in the next build phase.
      </p>
      <a href="#/style-guide" className="text-sm text-primary underline underline-offset-4">
        View the style guide
      </a>
    </main>
  );
}

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type Ctx = { announce: (msg: string) => void };
const AnnouncerContext = createContext<Ctx | null>(null);

export function AnnouncerProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const announce = useCallback((msg: string) => {
    if (timer.current) clearTimeout(timer.current);
    // Clear first so identical messages re-fire for screen readers.
    setMessage("");
    timer.current = setTimeout(() => setMessage(msg), 50);
  }, []);

  return (
    <AnnouncerContext.Provider value={{ announce }}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {message}
      </div>
    </AnnouncerContext.Provider>
  );
}

export function useAnnouncer(): Ctx {
  const ctx = useContext(AnnouncerContext);
  if (!ctx) return { announce: () => {} };
  return ctx;
}

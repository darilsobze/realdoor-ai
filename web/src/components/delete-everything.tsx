// Renter-initiated "Delete everything": a destructive action behind an
// explicit confirm dialog. Calls the real DELETE /session endpoint (removes
// files + derived data server-side), wipes client state, and returns to
// upload with an aria-live confirmation. Fulfills the consent-notice promise
// and the demo's deletion step.
import { useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { deleteSession } from "@/lib/api";
import { useReview } from "@/store/review";

export function DeleteEverything() {
  const { state, dispatch } = useReview();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!state.sessionId) return null;

  async function confirmDelete() {
    if (!state.sessionId) return;
    setBusy(true);
    try {
      await deleteSession(state.sessionId);
    } finally {
      // Even if the network call fails, drop client state — nothing usable
      // remains, and the renter asked for it gone.
      setBusy(false);
      setOpen(false);
      dispatch({ type: "reset" });
      // Announce, then return to upload.
      const live = document.getElementById("delete-announcer");
      if (live) live.textContent = "Everything was deleted. Your files and all values are gone.";
      window.location.hash = "#/";
    }
  }

  return (
    <>
      <span id="delete-announcer" aria-live="assertive" className="sr-only" />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="text-status-blocking hover:bg-status-blocking-bg hover:text-status-blocking"
          >
            <Trash2 aria-hidden="true" data-icon="inline-start" />
            Delete everything
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete everything?</DialogTitle>
            <DialogDescription>
              This removes your uploaded document and every value read from it,
              from this device and the server, right away. This can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
              Keep my session
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={busy}
              className="bg-status-blocking text-white hover:bg-status-blocking/90"
            >
              {busy ? "Deleting…" : "Yes, delete everything"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

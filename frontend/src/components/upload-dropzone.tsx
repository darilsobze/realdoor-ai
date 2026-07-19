import { useRef, useState, type DragEvent, type ChangeEvent } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";

const ACCEPT = "application/pdf,.pdf";
const MAX_MB = 15;

export function UploadDropzone({
  onFile,
  disabled,
}: {
  onFile: (file: File) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = (files: FileList | null) => {
    setError(null);
    const f = files?.[0];
    if (!f) return;
    if (f.type !== "application/pdf" && !/\.pdf$/i.test(f.name)) {
      setError("Unsupported file type. Use a synthetic PDF.");
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`File is larger than ${MAX_MB} MB.`);
      return;
    }
    onFile(f);
  };

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    if (disabled) return;
    handleFiles(e.dataTransfer.files);
  };

  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // Reset so the same file can be re-selected
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={[
          "flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed bg-card px-6 py-10 text-center transition-colors duration-150",
          dragOver ? "border-primary bg-accent/40" : "border-border",
          disabled ? "opacity-60" : "",
        ].join(" ")}
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-accent/60">
          <UploadCloud aria-hidden="true" className="size-6 text-primary" />
        </div>
        <p className="text-base font-medium">Drag a document here, or</p>
        <Button type="button" onClick={() => inputRef.current?.click()} disabled={disabled}>
          Choose a file
        </Button>
        <p className="text-xs text-muted-foreground">Synthetic PDF · up to {MAX_MB} MB</p>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={onChange}
          aria-label="Upload a document"
          tabIndex={-1}
        />
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-status-danger-foreground">
          {error}
        </p>
      ) : null}
    </div>
  );
}

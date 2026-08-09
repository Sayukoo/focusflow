import { memo, useState, type DragEvent } from "react";
import { Icon } from "../ui/Icon";

interface LibraryDropzoneProps {
  busy: boolean;
  onImport: () => void;
  onAddLink: (url: string) => void;
  onDropFiles: (files: File[]) => void;
}

export const LibraryDropzone = memo(function LibraryDropzone({
  busy,
  onImport,
  onAddLink,
  onDropFiles,
}: LibraryDropzoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [linkValue, setLinkValue] = useState("");

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!busy) setDragActive(true);
  };

  const handleDragLeave = () => setDragActive(false);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragActive(false);
    if (!busy) {
      onDropFiles(Array.from(event.dataTransfer.files));
    }
  };

  const submitLink = (value: string) => {
    const url = value.trim();
    if (!url || busy) return;
    onAddLink(url);
    setLinkValue("");
  };

  return (
    <div
      className={dragActive ? "library-dropzone is-dragging" : "library-dropzone"}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <span className="dropzone-icon" aria-hidden="true">
        <Icon name="folder-open" size={25} />
        <Icon name="plus" size={12} />
      </span>
      <strong>{dragActive ? "Release to upload" : "Drop music here"}</strong>
      <input
        className="dropzone-link-input"
        type="url"
        value={linkValue}
        placeholder="Paste a music link"
        aria-label="Paste a YouTube, Spotify, SoundCloud or TikTok link"
        disabled={busy}
        onChange={(event) => setLinkValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            submitLink(event.currentTarget.value);
          }
        }}
        onPaste={(event) => {
          const pasted = event.clipboardData.getData("text");
          if (!pasted.trim()) return;
          event.preventDefault();
          submitLink(pasted);
        }}
      />
      <button
        type="button"
        className="upload-button"
        disabled={busy}
        onClick={onImport}
      >
        <Icon name="plus" size={16} />
        Upload files
      </button>
    </div>
  );
});

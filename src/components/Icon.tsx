import type { ReactElement, SVGProps } from "react";

export type IconName =
  | "arrow-left"
  | "chevron-down"
  | "check"
  | "clock"
  | "close"
  | "folder"
  | "folder-open"
  | "heart"
  | "infinity"
  | "intervals"
  | "library"
  | "link"
  | "more"
  | "music"
  | "next"
  | "pause"
  | "play"
  | "plus"
  | "previous"
  | "refresh"
  | "repeat"
  | "share"
  | "sparkles"
  | "stopwatch"
  | "thumbs-down"
  | "trash"
  | "volume";

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

export function Icon({ name, size = 20, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className="icon-svg"
      fill="none"
      height={size}
      viewBox="0 0 24 24"
      width={size}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      {...props}
    >
      {iconPaths[name]}
    </svg>
  );
}

const iconPaths: Record<IconName, ReactElement> = {
  "arrow-left": (
    <>
      <path d="m15 18-6-6 6-6" />
      <path d="M9 12h10" />
    </>
  ),
  "chevron-down": <path d="m7 9 5 5 5-5" />,
  check: <path d="m5 12.5 4.2 4.2L19 7" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 7.5v4.9l3.2 1.8" />
    </>
  ),
  close: (
    <>
      <path d="m7 7 10 10" />
      <path d="m17 7-10 10" />
    </>
  ),
  folder: (
    <>
      <path d="M3.5 7.8a2 2 0 0 1 2-2h3l1.8 2h8.2a2 2 0 0 1 2 2v6.4a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />
      <path d="M3.8 10h16.1" />
    </>
  ),
  "folder-open": (
    <>
      <path d="M3.4 7.8a2 2 0 0 1 2-2h3l1.8 2h8.4a2 2 0 0 1 1.9 2.6l-1.4 5.1a2 2 0 0 1-1.9 1.5H5.1a2 2 0 0 1-1.9-2.5Z" />
      <path d="M4.5 10.3h15.8" />
    </>
  ),
  heart: <path d="M20.5 8.8c0 4.3-8.5 9.3-8.5 9.3S3.5 13.1 3.5 8.8A4.3 4.3 0 0 1 12 7.6a4.3 4.3 0 0 1 8.5 1.2Z" />,
  infinity: (
    <path d="M7.2 8.4c-2.4 0-4.2 1.5-4.2 3.6s1.8 3.6 4.2 3.6c2.1 0 3.4-1.6 4.8-3.6 1.4-2 2.7-3.6 4.8-3.6 2.4 0 4.2 1.5 4.2 3.6s-1.8 3.6-4.2 3.6c-2.1 0-3.4-1.6-4.8-3.6-1.4-2-2.7-3.6-4.8-3.6Z" />
  ),
  intervals: (
    <>
      <circle cx="12" cy="12" r="8.4" />
      <path d="M12 7.5v4.7l2.6 1.5" />
      <path d="M18.6 4.8v2.8M18.6 7.6h2.8" />
    </>
  ),
  library: (
    <>
      <path d="M5.5 4.5v15" />
      <path d="M9.7 4.5v15" />
      <path d="m14.1 5 3.9-1v15l-3.9 1Z" />
    </>
  ),
  link: (
    <>
      <path d="m9.5 14.5 5-5" />
      <path d="M7.2 17.8 5.7 19.3a3.5 3.5 0 0 1-5-5l3.1-3.1a3.5 3.5 0 0 1 5 0" />
      <path d="m16.8 6.2 1.5-1.5a3.5 3.5 0 1 1 5 5l-3.1 3.1a3.5 3.5 0 0 1-5 0" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="19" cy="12" r="1" fill="currentColor" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5l10-2v13" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </>
  ),
  next: (
    <>
      <path d="m5 5 7 7-7 7Z" fill="currentColor" stroke="none" />
      <path d="M12 5v14M19 5v14" />
    </>
  ),
  pause: (
    <>
      <path d="M8 5v14M16 5v14" strokeWidth="2.5" />
    </>
  ),
  play: <path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none" />,
  plus: (
    <>
      <path d="M12 5v14M5 12h14" />
    </>
  ),
  previous: (
    <>
      <path d="m19 5-7 7 7 7Z" fill="currentColor" stroke="none" />
      <path d="M12 5v14M5 5v14" />
    </>
  ),
  refresh: (
    <>
      <path d="M19 7v4h-4" />
      <path d="M19 11a7 7 0 1 0 1 4" />
    </>
  ),
  repeat: (
    <>
      <path d="M17 3.8 20 7l-3 3.2" />
      <path d="M4 7h13a3 3 0 0 1 3 3" />
      <path d="m7 20.2-3-3.2 3-3.2" />
      <path d="M20 17H7a3 3 0 0 1-3-3" />
    </>
  ),
  share: (
    <>
      <path d="M14 5h5v5" />
      <path d="m19 5-8 8" />
      <path d="M18 13v4.5a2 2 0 0 1-2 2H6.5a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2H11" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 1.2 4.8L18 9l-4.8 1.2L12 15l-1.2-4.8L6 9l4.8-1.2Z" />
      <path d="m19 15 .6 2.4L22 18l-2.4.6L19 21l-.6-2.4L16 18l2.4-.6Z" />
    </>
  ),
  stopwatch: (
    <>
      <circle cx="12" cy="13" r="7.4" />
      <path d="M12 13V9.5M12 3v2M9.5 3h5M17.5 7.5l1.5-1.5" />
    </>
  ),
  "thumbs-down": (
    <>
      <path d="M7 10v9a2 2 0 0 0 2 2l4-7v-4H7Z" />
      <path d="M7 10H4.7A1.7 1.7 0 0 1 3 8.3l1-5.1A1.5 1.5 0 0 1 5.5 2H14a2 2 0 0 1 1.9 2.6L14.5 10" />
      <path d="M14.5 10H19a2 2 0 0 1 1.9 2.6l-1.1 3.3A2 2 0 0 1 17.9 17H13" />
    </>
  ),
  trash: (
    <>
      <path d="M5 7h14M10 3h4l1 4H9ZM7 7l.7 13h8.6L17 7M10 11v5M14 11v5" />
    </>
  ),
  volume: (
    <>
      <path d="M4 10h3l4-3v10l-4-3H4Z" />
      <path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11" />
    </>
  ),
};

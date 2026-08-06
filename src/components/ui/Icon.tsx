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
  | "menu"
  | "more"
  | "music"
  | "music-queue"
  | "next"
  | "pause"
  | "play"
  | "pin"
  | "plus"
  | "previous"
  | "refresh"
  | "repeat"
  | "share"
  | "shuffle"
  | "sparkles"
  | "stopwatch"
  | "target"
  | "thumbs-down"
  | "trash"
  | "user"
  | "volume";

interface IconProps extends SVGProps<SVGSVGElement> {
  name: IconName;
  size?: number;
}

const icons: Record<IconName, ReactElement> = {
  "arrow-left": <path d="M19 12H5M12 19l-7-7 7-7" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  check: <path d="M20 6 9 17l-5-5" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  close: <path d="M18 6 6 18M6 6l12 12" />,
  folder: (
    <>
      <path d="M3.5 7.8a2 2 0 0 1 2-2h3l1.8 2h8.2a2 2 0 0 1 2 2v6.4a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />
      <path d="M3.8 10h16.1" />
    </>
  ),
  "folder-open": (
    <>
      <path d="M3.5 6.5A2 2 0 0 1 5.5 4.5h4.2a2 2 0 0 1 1.4.6l1.4 1.4a2 2 0 0 0 1.4.6H18.5a2 2 0 0 1 2 2v2" />
      <path d="M2.5 19.5L4.8 10a1.8 1.8 0 0 1 1.75-1.4h14.9a1.8 1.8 0 0 1 1.75 2.2l-2 8a1.8 1.8 0 0 1-1.75 1.4H4.25a1.8 1.8 0 0 1-1.75-2.2Z" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
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
      <path d="M13 8.5h3a4 4 0 0 1 0 8h-2" />
      <path d="M11 15.5H8a4 4 0 0 1 0-8h2" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  more: (
    <>
      <circle cx="12" cy="5" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="12" cy="19" r="1.5" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </>
  ),
  "music-queue": (
    <>
      <path d="M4 6h10" />
      <path d="M4 12h10" />
      <path d="M4 18h6" />
      <path d="M16 18V8l5-1.2v7.7" />
      <circle cx="14.5" cy="18" r="1.5" />
      <circle cx="19.5" cy="16.8" r="1.5" />
    </>
  ),
  next: (
    <>
      <path d="m8 6 6 6-6 6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m14 6 6 6-6 6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  previous: (
    <>
      <path d="m16 6-6 6 6 6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m10 6-6 6 6 6" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  pause: (
    <>
      <rect x="6" y="5" width="4" height="14" rx="1.5" />
      <rect x="14" y="5" width="4" height="14" rx="1.5" />
    </>
  ),
  play: <path d="M7 4.5v15l12-7.5Z" />,
  pin: (
    <>
      <path d="M12 17v5" />
      <path d="M9 4h6l1 5-2 3v5h-4v-5L8 9Z" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  refresh: (
    <>
      <path d="M20 12A8 8 0 1 1 17.3 6.3L20 9" />
      <path d="M20 4v5h-5" />
    </>
  ),
  repeat: (
    <>
      <path d="M17 2v4H3v6" />
      <path d="m14 5 3-3 3 3" />
      <path d="M7 22v-4h14v-6" />
      <path d="m10 19-3 3-3-3" />
    </>
  ),
  shuffle: (
    <>
      <path d="M4 7h2c1.5 0 2.4.6 3.4 2l5.2 6.9c.9 1.2 1.8 2 3.4 2H20" />
      <path d="m17 15 3 3-3 3" />
      <path d="M4 18h2c1.5 0 2.4-.6 3.4-2l1.3-1.7" />
      <path d="m14.6 9.7 1.4-1.7c.9-1.2 1.8-2 3.4-2H20" />
      <path d="m17 3 3 3-3 3" />
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
  user: (
    <>
      <circle cx="12" cy="7.5" r="4" />
      <path d="M4.5 20a7.5 7.5 0 0 1 15 0" />
    </>
  ),
  volume: (
    <>
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 5.5a9 9 0 0 1 0 13" />
    </>
  ),
};

export function Icon({
  name,
  size = 18,
  className = "",
  ...rest
}: IconProps): ReactElement {
  return (
    <svg
      className={`icon-svg icon-${name} ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {icons[name]}
    </svg>
  );
}

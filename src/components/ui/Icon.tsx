import type { ReactElement, SVGProps } from "react";

export type IconName =
  | "arrow-left"
  | "chart-bar"
  | "chevron-down"
  | "check"
  | "clock"
  | "close"
  | "flame"
  | "folder"
  | "folder-open"
  | "heart"
  | "infinity"
  | "intervals"
  | "keyboard"
  | "library"
  | "music-library"
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
  "chart-bar": (
    <>
      <path d="M12 20V10M18 20V4M6 20v-6" />
    </>
  ),
  flame: (
    <path d="M8.5 14.5A2.5 2.5 0 0 0 11 17c1.38 0 2.5-1.12 2.5-2.5 0-1.87-1.5-3-2.5-4.5-1.5 1.5-2.5 2.8-2.5 4.5Z M12 2C8 6 4 10 4 14.5A8 8 0 0 0 20 14.5C20 10 17 6.5 12 2Z" />
  ),
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
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </>
  ),
  "folder-open": (
    <>
      <path d="M4 9V5a2 2 0 0 1 2-2h3.5l1.8 2H18a2 2 0 0 1 2 2v2" />
      <path d="M3 20h18a1 1 0 0 0 1-1.17l-1.8-9A1 1 0 0 0 21.2 9H6.4a1 1 0 0 0-1 .8L3 20Z" />
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
  keyboard: (
    <>
      <rect x="2" y="4" width="20" height="16" rx="2.5" />
      <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8" />
    </>
  ),
  library: (
    <>
      <path d="M5.5 4.5v15" />
      <path d="M9.7 4.5v15" />
      <path d="m14.1 5 3.9-1v15l-3.9 1Z" />
    </>
  ),
  "music-library": (
    <>
      <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.9 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
      <path d="M11.5 16.5v-5.2l5-1.3v4.5" />
      <circle cx="10" cy="16.5" r="1.5" />
      <circle cx="15" cy="14.5" r="1.5" />
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
      <path d="M8.4 4.5h7.2l-.8 4.1 2.8 2.8v1.6H6.4v-1.6l2.8-2.8Z" />
      <path d="M12 13v7.6" />
      <path d="m9.6 20.6 2.4-2.4 2.4 2.4" />
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

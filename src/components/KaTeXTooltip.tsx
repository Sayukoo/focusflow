import katex from "katex";
import { createPortal } from "react-dom";
import {
  cloneElement,
  isValidElement,
  useId,
  useLayoutEffect,
  useRef,
  useMemo,
  useState,
  type CSSProperties,
  type FocusEvent,
  type MouseEvent,
  type ReactElement,
  type ReactNode,
} from "react";
import "katex/dist/katex.min.css";

interface KaTeXTooltipProps {
  formula: string;
  children: ReactElement;
  placement?: "top" | "bottom" | "left" | "right";
}

type InteractiveProps = {
  onMouseEnter?: (event: MouseEvent) => void;
  onMouseLeave?: (event: MouseEvent) => void;
  onFocus?: (event: FocusEvent) => void;
  onBlur?: (event: FocusEvent) => void;
  "aria-describedby"?: string;
};

export function KaTeXTooltip({
  formula,
  children,
  placement = "top",
}: KaTeXTooltipProps) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const bubbleRef = useRef<HTMLSpanElement>(null);
  const [bubbleStyle, setBubbleStyle] = useState<CSSProperties>();
  const [safePlacement, setSafePlacement] = useState(placement);

  const html = useMemo(() => {
    try {
      return katex.renderToString(formula, {
        throwOnError: false,
        displayMode: false,
        output: "html",
      });
    } catch {
      return escapeHtml(formulaToText(formula));
    }
  }, [formula]);

  useLayoutEffect(() => {
    if (!open || !wrapperRef.current || !bubbleRef.current) return;

    const updatePosition = () => {
      const anchor = wrapperRef.current?.getBoundingClientRect();
      const bubble = bubbleRef.current?.getBoundingClientRect();
      if (!anchor || !bubble) return;

      const gap = 9;
      const margin = 8;
      let nextPlacement = placement;
      if (placement === "top" && anchor.top - bubble.height - gap < margin) {
        nextPlacement = "bottom";
      } else if (
        placement === "bottom" &&
        anchor.bottom + bubble.height + gap > window.innerHeight - margin
      ) {
        nextPlacement = "top";
      } else if (placement === "left" && anchor.left - bubble.width - gap < margin) {
        nextPlacement = "right";
      } else if (
        placement === "right" &&
        anchor.right + bubble.width + gap > window.innerWidth - margin
      ) {
        nextPlacement = "left";
      }

      const vertical =
        nextPlacement === "top"
          ? anchor.top - bubble.height - gap
          : nextPlacement === "bottom"
            ? anchor.bottom + gap
            : anchor.top + (anchor.height - bubble.height) / 2;
      const horizontal =
        nextPlacement === "left"
          ? anchor.left - bubble.width - gap
          : nextPlacement === "right"
            ? anchor.right + gap
            : anchor.left + (anchor.width - bubble.width) / 2;

      setSafePlacement(nextPlacement);
      setBubbleStyle({
        "--tip-max": "18rem",
        top: Math.max(margin, Math.min(vertical, window.innerHeight - bubble.height - margin)),
        left: Math.max(margin, Math.min(horizontal, window.innerWidth - bubble.width - margin)),
      } as CSSProperties);
    };

    const frame = window.requestAnimationFrame(updatePosition);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, placement, formula]);

  if (!isValidElement(children)) {
    return children as ReactNode;
  }

  const existing = children.props as InteractiveProps;

  const child = cloneElement(children, {
    "aria-describedby": open ? tooltipId : undefined,
    onMouseEnter: (event: MouseEvent) => {
      setOpen(true);
      existing.onMouseEnter?.(event);
    },
    onMouseLeave: (event: MouseEvent) => {
      setOpen(false);
      existing.onMouseLeave?.(event);
    },
    onFocus: (event: FocusEvent) => {
      setOpen(true);
      existing.onFocus?.(event);
    },
    onBlur: (event: FocusEvent) => {
      setOpen(false);
      existing.onBlur?.(event);
    },
  } as InteractiveProps);

  return (
    <span ref={wrapperRef} className={`katex-tip katex-tip--${safePlacement}`}>
      {child}
      {open ? (
        createPortal(
          <span
            id={tooltipId}
            role="tooltip"
            ref={bubbleRef}
            className="katex-tip__bubble"
            dangerouslySetInnerHTML={{ __html: html }}
            style={bubbleStyle}
          />,
          document.body,
        )
      ) : null}
    </span>
  );
}

function formulaToText(formula: string): string {
  return formula
    .replace(/\\texttt\{([^{}]*)\}/g, "$1")
    .replace(/\\text\{([^{}]*)\}/g, "$1")
    .replace(/\\infty/g, "∞")
    .replace(/\\%/g, "%")
    .replace(/\\[a-zA-Z]+/g, "")
    .replace(/[{}]/g, "")
    .replace(/~/g, " ")
    .replace(/\\\\/g, "\\")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

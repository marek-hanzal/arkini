import { gsap } from "gsap";
import type { FlyerKind, RectLike } from "../types";

const flyDurationSeconds = 0.32;
const stashExitSeconds = 0.08;
const successDurationSeconds = 0.56;
const errorDurationSeconds = 0.26;
const sheetDurationSeconds = 0.22;

export interface FlyerTimelineProps {
  from: RectLike;
  to: RectLike;
  kind: FlyerKind;
}

export function playFlyerTimeline(element: HTMLElement, { from, to, kind }: FlyerTimelineProps) {
  const x = to.left - from.left;
  const y = to.top - from.top;
  const scale = from.width > 0 ? to.width / from.width : 1;
  const exitY = y + 34;

  gsap.killTweensOf(element);

  return new Promise<void>((resolve) => {
    const done = once(resolve);
    const timeline = gsap.timeline({ onComplete: done, onInterrupt: done });

    timeline.set(element, {
      x: 0,
      y: 0,
      scale: 1,
      opacity: kind === "place" ? 0.95 : 1,
      transformOrigin: "top left",
      force3D: true,
    });

    if (kind === "stash") {
      timeline
        .to(element, { x, y, scale, opacity: 1, duration: flyDurationSeconds - stashExitSeconds, ease: "power3.out" })
        .to(element, { y: exitY, opacity: 0, duration: stashExitSeconds, ease: "power2.in" });
      return;
    }

    timeline.to(element, {
      x,
      y,
      scale,
      opacity: kind === "place" ? 0 : 1,
      duration: flyDurationSeconds,
      ease: "power3.out",
    });
  });
}

export function playCellSuccess(element: HTMLElement) {
  gsap.killTweensOf(element);
  gsap.timeline()
    .set(element, { boxShadow: "inset 0 0 0 0 rgb(167 243 208 / 0.78)", backgroundColor: "rgb(6 78 59 / 0.18)" })
    .to(element, {
      backgroundColor: "rgb(6 95 70 / 0.38)",
      boxShadow: "inset 0 0 0 0.16rem rgb(167 243 208 / 0.88), inset 0 0 1.2rem rgb(52 211 153 / 0.24)",
      duration: successDurationSeconds * 0.42,
      ease: "power2.out",
    })
    .to(element, {
      backgroundColor: "rgba(15, 23, 42, 0)",
      boxShadow: "inset 0 0 0 0.45rem rgb(167 243 208 / 0)",
      duration: successDurationSeconds * 0.58,
      ease: "power2.out",
      clearProps: "backgroundColor,boxShadow",
    });
}

export function playCellError(element: HTMLElement) {
  gsap.killTweensOf(element, "x");
  gsap.timeline()
    .to(element, { x: -3, duration: errorDurationSeconds * 0.25, ease: "power2.out" })
    .to(element, { x: 3, duration: errorDurationSeconds * 0.25, ease: "power2.inOut" })
    .to(element, { x: -2, duration: errorDurationSeconds * 0.25, ease: "power2.inOut" })
    .to(element, { x: 0, duration: errorDurationSeconds * 0.25, ease: "power2.out", clearProps: "x" });
}

export function playBottomNavPulse(element: HTMLElement) {
  gsap.killTweensOf(element);
  gsap.timeline({ defaults: { ease: "power2.out" } })
    .set(element, {
      boxShadow: "0 0 0 0 rgb(45 212 191 / 0.58)",
      borderColor: "rgb(94 234 212 / 0.98)",
      backgroundColor: "rgb(20 184 166 / 0.34)",
      color: "rgb(240 253 250)",
      y: 0,
      scale: 1,
    })
    .to(element, { boxShadow: "0 0 0 0.45rem rgb(45 212 191 / 0)", y: -1, scale: 1.035, duration: 0.22 })
    .to(element, {
      boxShadow: "0 0 0 0 rgb(45 212 191 / 0)",
      y: 0,
      scale: 1,
      duration: 0.34,
      clearProps: "boxShadow,transform,borderColor,backgroundColor,color",
    });
}

export function animateBottomSheet({ panel, backdrop, open }: { panel: HTMLElement; backdrop: HTMLElement; open: boolean }) {
  gsap.killTweensOf([panel, backdrop]);

  if (open) {
    gsap.set([panel, backdrop], { pointerEvents: "auto" });
    gsap.timeline({ defaults: { ease: "power3.out" } })
      .to(backdrop, { opacity: 1, duration: 0.18 }, 0)
      .to(panel, { opacity: 1, y: 0, duration: sheetDurationSeconds }, 0);
    return;
  }

  gsap.timeline({
    defaults: { ease: "power2.in" },
    onComplete: () => gsap.set([panel, backdrop], { pointerEvents: "none" }),
  })
    .to(backdrop, { opacity: 0, duration: 0.16 }, 0)
    .to(panel, { opacity: 0, y: "calc(100% + 1rem)", duration: 0.2 }, 0);
}

function once(fn: () => void) {
  let called = false;
  return () => {
    if (called) return;
    called = true;
    fn();
  };
}

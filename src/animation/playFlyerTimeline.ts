import { gsap } from "gsap";
import type { FlyerKind, RectLike } from "~/play/types";
import { once } from "./once";
import { playMergeCrossFade } from "./playMergeCrossFade";

const flyDurationSeconds = 0.28;
const stashExitSeconds = 0.07;
const fadeOutSeconds = 0.12;
const consumeDurationSeconds = 0.16;

export namespace playFlyerTimeline {
	export interface Props {
		from: RectLike;
		to: RectLike;
		kind: FlyerKind;
	}
}

export const playFlyerTimeline = (
	element: HTMLElement,
	{ from, to, kind }: playFlyerTimeline.Props,
) => {
	const x = to.left - from.left;
	const y = to.top - from.top;
	const scale = from.width > 0 ? to.width / from.width : 1;
	const exitY = y + 34;

	gsap.killTweensOf(element);

	const crossFadeFrom = element.querySelector<HTMLElement>("[data-ak-fly-crossfade-from]");
	const crossFadeTo = element.querySelector<HTMLElement>("[data-ak-fly-crossfade-to]");

	return new Promise<void>((resolve) => {
		const done = once(resolve);
		const timeline = gsap.timeline({
			onComplete: done,
			onInterrupt: done,
		});

		timeline.set(element, {
			x: 0,
			y: 0,
			scale: 1,
			opacity: 1,
			transformOrigin: "top left",
			force3D: true,
		});

		if (crossFadeFrom && crossFadeTo) {
			timeline
				.set(crossFadeFrom, {
					opacity: 1,
					transformOrigin: "center",
					willChange: "opacity",
				})
				.set(crossFadeTo, {
					opacity: 0,
					scale: 1,
					transformOrigin: "center",
					willChange: "opacity",
				});
		}

		if (kind === "stash") {
			timeline
				.to(element, {
					x,
					y,
					scale,
					opacity: 1,
					duration: flyDurationSeconds - stashExitSeconds,
					ease: "power3.out",
				})
				.to(element, {
					y: exitY,
					opacity: 0,
					duration: stashExitSeconds,
					ease: "power2.in",
				});
			return;
		}

		if (kind === "deplete") {
			timeline.to(element, {
				y: -8,
				scale: 0.72,
				opacity: 0,
				duration: 0.22,
				ease: "power2.in",
			});
			return;
		}

		if (kind === "merge-crossfade") {
			playMergeCrossFade({
				timeline,
				from: crossFadeFrom,
				to: crossFadeTo,
			});
			return;
		}

		if (kind === "fade-out") {
			timeline.to(element, {
				opacity: 0,
				duration: fadeOutSeconds,
				ease: "none",
			});
			return;
		}

		if (kind === "consume") {
			timeline.set(element, {
				transformOrigin: "center",
			});
			timeline.to(element, {
				scale: 0.34,
				opacity: 0,
				duration: consumeDurationSeconds,
				ease: "power2.in",
			});
			return;
		}

		if (kind === "imprint-source") {
			timeline
				.set(element, {
					x,
					y,
					scale: 0.82,
					opacity: 0,
				})
				.to(element, {
					scale: 1.18,
					opacity: 1,
					duration: 0.16,
					ease: "back.out(2.8)",
				})
				.to(element, {
					scale: 1,
					duration: 0.18,
					ease: "power2.out",
				});
			return;
		}

		timeline.to(element, {
			x,
			y,
			scale,
			opacity: 1,
			duration: flyDurationSeconds,
			ease: "power3.out",
		});
	});
};

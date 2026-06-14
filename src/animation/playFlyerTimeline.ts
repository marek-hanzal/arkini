import { gsap } from "gsap";
import type { FlyerKind, RectLike } from "~/play/types";
import { once } from "./once";
import { playMergeCrossFade } from "./playMergeCrossFade";

const flyDurationSeconds = 0.32;
const stashExitSeconds = 0.08;

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
				})
				.set(crossFadeTo, {
					opacity: 0,
					scale: 0.92,
					transformOrigin: "center",
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
				duration: 0.26,
				ease: "power2.in",
			});
			return;
		}

		if (kind === "merge-source") {
			playMergeCrossFade({
				timeline,
				from: crossFadeFrom,
				to: crossFadeTo,
			});
			timeline
				.to(
					element,
					{
						x,
						y,
						scale: scale * 0.74,
						opacity: 0.86,
						duration: 0.22,
						ease: "power3.out",
					},
					0,
				)
				.to(element, {
					scale: scale * 0.52,
					opacity: 0,
					duration: 0.12,
					ease: "power2.in",
				});
			return;
		}

		if (kind === "merge-target") {
			playMergeCrossFade({
				timeline,
				from: crossFadeFrom,
				to: crossFadeTo,
			});
			timeline
				.to(
					element,
					{
						x,
						y,
						scale: 1.13,
						opacity: 0.92,
						duration: 0.15,
						ease: "power2.out",
					},
					0,
				)
				.to(element, {
					scale: 0.9,
					opacity: 0,
					duration: 0.18,
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
					duration: 0.18,
					ease: "back.out(2.8)",
				})
				.to(element, {
					scale: 1,
					duration: 0.22,
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

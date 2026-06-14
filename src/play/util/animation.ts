import { gsap } from "gsap";
import type { FlyerKind, RectLike } from "~/play/types";

const flyDurationSeconds = 0.32;
const stashExitSeconds = 0.08;
const successDurationSeconds = 0.56;
const errorDurationSeconds = 0.26;
const sheetDurationSeconds = 0.28;
const bottomNavHoldMs = 900;
const bottomNavHoldTimers = new WeakMap<HTMLElement, number>();

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
			playMergeCrossFade(timeline, crossFadeFrom, crossFadeTo);
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
			playMergeCrossFade(timeline, crossFadeFrom, crossFadeTo);
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
}

function playMergeCrossFade(
	timeline: gsap.core.Timeline,
	from: HTMLElement | null,
	to: HTMLElement | null,
) {
	if (!from || !to) return;

	timeline
		.to(
			from,
			{
				opacity: 0,
				duration: 0.18,
				ease: "power1.out",
			},
			0.06,
		)
		.to(
			to,
			{
				opacity: 1,
				scale: 1,
				duration: 0.2,
				ease: "power2.out",
			},
			0.06,
		);
}

export function playCellImprint(element: HTMLElement) {
	gsap.killTweensOf(element);
	gsap.timeline()
		.set(element, {
			boxShadow: "inset 0 0 0 0 rgb(196 181 253 / 0.86)",
			backgroundColor: "rgb(49 46 129 / 0.22)",
		})
		.to(element, {
			scale: 1.035,
			backgroundColor: "rgb(67 56 202 / 0.36)",
			boxShadow:
				"inset 0 0 0 0.18rem rgb(196 181 253 / 0.88), inset 0 0 1.35rem rgb(129 140 248 / 0.32)",
			duration: 0.22,
			ease: "back.out(2)",
		})
		.to(element, {
			scale: 1,
			backgroundColor: "rgba(15, 23, 42, 0)",
			boxShadow: "inset 0 0 0 0.5rem rgb(196 181 253 / 0)",
			duration: 0.38,
			ease: "power2.out",
			clearProps: "backgroundColor,boxShadow,scale",
		});
}

export function playCellSuccess(element: HTMLElement) {
	gsap.killTweensOf(element);
	gsap.timeline()
		.set(element, {
			boxShadow: "inset 0 0 0 0 rgb(167 243 208 / 0.78)",
			backgroundColor: "rgb(6 78 59 / 0.18)",
		})
		.to(element, {
			backgroundColor: "rgb(6 95 70 / 0.38)",
			boxShadow:
				"inset 0 0 0 0.16rem rgb(167 243 208 / 0.88), inset 0 0 1.2rem rgb(52 211 153 / 0.24)",
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
		.to(element, {
			x: -3,
			duration: errorDurationSeconds * 0.25,
			ease: "power2.out",
		})
		.to(element, {
			x: 3,
			duration: errorDurationSeconds * 0.25,
			ease: "power2.inOut",
		})
		.to(element, {
			x: -2,
			duration: errorDurationSeconds * 0.25,
			ease: "power2.inOut",
		})
		.to(element, {
			x: 0,
			duration: errorDurationSeconds * 0.25,
			ease: "power2.out",
			clearProps: "x",
		});
}

export function playProducerCooldown(element: HTMLElement) {
	gsap.killTweensOf(element, "backgroundColor,boxShadow");
	gsap.timeline()
		.to(element, {
			backgroundColor: "rgb(15 23 42 / 0.18)",
			boxShadow:
				"inset 0 0 0 0.14rem rgb(45 212 191 / 0.34), inset 0 0 1rem rgb(45 212 191 / 0.16)",
			duration: 0.12,
			ease: "power2.out",
		})
		.to(element, {
			backgroundColor: "rgb(15 23 42 / 0)",
			boxShadow: "inset 0 0 0 0.32rem rgb(45 212 191 / 0)",
			duration: 0.28,
			ease: "power2.out",
			clearProps: "backgroundColor,boxShadow",
		});
}

export function playBottomNavPulse(element: HTMLElement) {
	playBottomNavHold(element);
}

export function playBottomNavHold(element: HTMLElement, holdMs = bottomNavHoldMs) {
	window.clearTimeout(bottomNavHoldTimers.get(element));

	gsap.killTweensOf(element);
	gsap.set(element, {
		boxShadow: "0 0 0 0.22rem rgb(45 212 191 / 0.18)",
		borderColor: "rgb(94 234 212 / 0.92)",
		backgroundColor: "rgb(20 184 166 / 0.28)",
		color: "rgb(240 253 250)",
	});
	gsap.fromTo(
		element,
		{
			y: -1,
			scale: 1.025,
		},
		{
			y: 0,
			scale: 1,
			duration: 0.24,
			ease: "power2.out",
		},
	);

	const timer = window.setTimeout(() => {
		bottomNavHoldTimers.delete(element);
		gsap.to(element, {
			boxShadow: "0 0 0 0 rgb(45 212 191 / 0)",
			duration: 0.22,
			ease: "power2.out",
			clearProps: "boxShadow,transform,borderColor,backgroundColor,color",
		});
	}, holdMs);
	bottomNavHoldTimers.set(element, timer);
}

export function animateBottomSheet({
	panel,
	backdrop,
	open,
}: {
	panel: HTMLElement;
	backdrop: HTMLElement;
	open: boolean;
}) {
	gsap.killTweensOf([
		panel,
		backdrop,
	]);

	if (open) {
		gsap.set(
			[
				panel,
				backdrop,
			],
			{
				pointerEvents: "auto",
			},
		);
		gsap.timeline({
			defaults: {
				duration: sheetDurationSeconds,
				ease: "power3.out",
			},
		})
			.to(
				backdrop,
				{
					opacity: 1,
				},
				0,
			)
			.fromTo(
				panel,
				{
					opacity: 0,
					yPercent: 100,
					y: 16,
				},
				{
					opacity: 1,
					yPercent: 0,
					y: 0,
				},
				0,
			);
		return;
	}

	gsap.timeline({
		defaults: {
			duration: sheetDurationSeconds,
			ease: "power3.inOut",
		},
		onComplete: () =>
			gsap.set(
				[
					panel,
					backdrop,
				],
				{
					pointerEvents: "none",
				},
			),
	})
		.to(
			backdrop,
			{
				opacity: 0,
			},
			0,
		)
		.to(
			panel,
			{
				opacity: 0,
				yPercent: 100,
				y: 16,
			},
			0,
		);
}

function once(fn: () => void) {
	let called = false;
	return () => {
		if (called) return;
		called = true;
		fn();
	};
}

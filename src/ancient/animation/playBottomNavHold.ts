import { animate, type AnimationPlaybackControlsWithThen } from "motion";

const bottomNavHoldMs = 900;
const bottomNavHoldTimers = new WeakMap<HTMLElement, number>();
const activeAnimations = new WeakMap<HTMLElement, AnimationPlaybackControlsWithThen[]>();

const cancelAnimations = (element: HTMLElement) => {
	for (const animation of activeAnimations.get(element) ?? []) animation.cancel();
	activeAnimations.delete(element);
};

const clearHoldStyles = (element: HTMLElement) => {
	element.style.removeProperty("background-color");
	element.style.removeProperty("border-color");
	element.style.removeProperty("box-shadow");
	element.style.removeProperty("color");
	element.style.removeProperty("transform");
};

export const playBottomNavHold = (element: HTMLElement, holdMs = bottomNavHoldMs) => {
	window.clearTimeout(bottomNavHoldTimers.get(element));
	cancelAnimations(element);

	element.style.boxShadow = "0 0 0 0.22rem rgba(45, 212, 191, 0.18)";
	element.style.borderColor = "rgba(94, 234, 212, 0.92)";
	element.style.backgroundColor = "rgba(20, 184, 166, 0.28)";
	element.style.color = "rgb(240, 253, 250)";

	const settleAnimation = animate(
		element,
		{
			y: [
				-1,
				0,
			],
			scale: [
				1.025,
				1,
			],
		},
		{
			duration: 0.24,
			ease: "easeOut",
		},
	);
	activeAnimations.set(element, [
		settleAnimation,
	]);

	const timer = window.setTimeout(() => {
		bottomNavHoldTimers.delete(element);
		const fadeAnimation = animate(
			element,
			{
				boxShadow: "0 0 0 0 rgba(45, 212, 191, 0)",
			},
			{
				duration: 0.22,
				ease: "easeOut",
			},
		);
		activeAnimations.set(element, [
			fadeAnimation,
		]);
		void fadeAnimation.finished
			.catch(() => {})
			.finally(() => {
				if (!activeAnimations.get(element)?.includes(fadeAnimation)) return;
				activeAnimations.delete(element);
				clearHoldStyles(element);
			});
	}, holdMs);
	bottomNavHoldTimers.set(element, timer);
};

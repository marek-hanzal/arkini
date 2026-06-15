import { animate, type AnimationPlaybackControlsWithThen } from "motion";

const activeAnimations = new WeakMap<HTMLElement, AnimationPlaybackControlsWithThen>();

export const playCellImprint = (element: HTMLElement) => {
	activeAnimations.get(element)?.cancel();
	element.style.backgroundColor = "rgba(49, 46, 129, 0.22)";
	element.style.boxShadow = "inset 0 0 0 0 rgba(196, 181, 253, 0.86)";

	const animation = animate(
		element,
		{
			backgroundColor: [
				"rgba(49, 46, 129, 0.22)",
				"rgba(67, 56, 202, 0.36)",
				"rgba(15, 23, 42, 0)",
			],
			boxShadow: [
				"inset 0 0 0 0 rgba(196, 181, 253, 0.86), inset 0 0 0 rgba(129, 140, 248, 0)",
				"inset 0 0 0 0.18rem rgba(196, 181, 253, 0.88), inset 0 0 1.35rem rgba(129, 140, 248, 0.32)",
				"inset 0 0 0 0.5rem rgba(196, 181, 253, 0), inset 0 0 1.35rem rgba(129, 140, 248, 0)",
			],
			scale: [
				1,
				1.035,
				1,
			],
		},
		{
			duration: 0.6,
			times: [
				0,
				0.37,
				1,
			],
			ease: [
				0.22,
				1,
				0.36,
				1,
			],
		},
	);

	activeAnimations.set(element, animation);
	void animation.finished
		.catch(() => {})
		.finally(() => {
			if (activeAnimations.get(element) !== animation) return;
			activeAnimations.delete(element);
			element.style.removeProperty("background-color");
			element.style.removeProperty("box-shadow");
			element.style.removeProperty("transform");
		});
};

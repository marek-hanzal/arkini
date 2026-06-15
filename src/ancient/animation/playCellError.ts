import { animate, type AnimationPlaybackControlsWithThen } from "motion";

const errorDurationSeconds = 0.26;
const activeAnimations = new WeakMap<HTMLElement, AnimationPlaybackControlsWithThen>();

export const playCellError = (element: HTMLElement) => {
	activeAnimations.get(element)?.cancel();

	const animation = animate(
		element,
		{
			x: [
				0,
				-3,
				3,
				-2,
				0,
			],
		},
		{
			duration: errorDurationSeconds,
			times: [
				0,
				0.25,
				0.5,
				0.75,
				1,
			],
			ease: "easeInOut",
		},
	);

	activeAnimations.set(element, animation);
	void animation.finished
		.catch(() => {})
		.finally(() => {
			if (activeAnimations.get(element) !== animation) return;
			activeAnimations.delete(element);
			element.style.removeProperty("transform");
		});
};

import { animate, type AnimationPlaybackControlsWithThen } from "motion";

const successDurationSeconds = 0.56;
const activeAnimations = new WeakMap<HTMLElement, AnimationPlaybackControlsWithThen>();

export const playCellSuccess = (element: HTMLElement) => {
	activeAnimations.get(element)?.cancel();
	element.style.backgroundColor = "rgba(6, 78, 59, 0.18)";
	element.style.boxShadow = "inset 0 0 0 0 rgba(167, 243, 208, 0.78)";

	const animation = animate(
		element,
		{
			backgroundColor: [
				"rgba(6, 78, 59, 0.18)",
				"rgba(6, 95, 70, 0.38)",
				"rgba(15, 23, 42, 0)",
			],
			boxShadow: [
				"inset 0 0 0 0 rgba(167, 243, 208, 0.78), inset 0 0 0 rgba(52, 211, 153, 0)",
				"inset 0 0 0 0.16rem rgba(167, 243, 208, 0.88), inset 0 0 1.2rem rgba(52, 211, 153, 0.24)",
				"inset 0 0 0 0.45rem rgba(167, 243, 208, 0), inset 0 0 1.2rem rgba(52, 211, 153, 0)",
			],
		},
		{
			duration: successDurationSeconds,
			times: [
				0,
				0.42,
				1,
			],
			ease: "easeOut",
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
		});
};

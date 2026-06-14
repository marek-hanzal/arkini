import { gsap } from "gsap";

const errorDurationSeconds = 0.26;

export const playCellError = (element: HTMLElement) => {
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
};

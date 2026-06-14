import { gsap } from "gsap";

export const playCellImprint = (element: HTMLElement) => {
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
};

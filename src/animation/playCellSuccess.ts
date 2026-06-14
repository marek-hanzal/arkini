import { gsap } from "gsap";

const successDurationSeconds = 0.56;

export const playCellSuccess = (element: HTMLElement) => {
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
};

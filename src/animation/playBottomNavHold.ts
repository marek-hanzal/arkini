import { gsap } from "gsap";

const bottomNavHoldMs = 900;
const bottomNavHoldTimers = new WeakMap<HTMLElement, number>();

export const playBottomNavHold = (element: HTMLElement, holdMs = bottomNavHoldMs) => {
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
};

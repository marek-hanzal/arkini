export const itemDetailMotionTransition = {
	duration: 0.2,
	ease: [
		0.22,
		1,
		0.36,
		1,
	] as const,
};

export const itemDetailFadeMotion = {
	animate: {
		opacity: 1,
		y: 0,
	},
	exit: {
		opacity: 0,
		y: -4,
	},
	initial: {
		opacity: 0,
		y: 4,
	},
	transition: itemDetailMotionTransition,
} as const;

export const itemDetailBadgeMotion = {
	animate: {
		opacity: 1,
		scale: 1,
	},
	exit: {
		opacity: 0,
		scale: 0.94,
	},
	initial: {
		opacity: 0,
		scale: 0.94,
	},
	transition: itemDetailMotionTransition,
} as const;

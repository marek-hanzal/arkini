import type { RectLike } from "~/play/types";

export const rectDistance = (left: RectLike, right: RectLike) => {
	const dx = Math.max(
		right.left - (left.left + left.width),
		left.left - (right.left + right.width),
		0,
	);
	const dy = Math.max(
		right.top - (left.top + left.height),
		left.top - (right.top + right.height),
		0,
	);
	return Math.hypot(dx, dy);
};

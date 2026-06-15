import type { RectLike } from "~/play/types";

export const rectOverlapArea = (left: RectLike, right: RectLike) => {
	const width = Math.max(
		0,
		Math.min(left.left + left.width, right.left + right.width) -
			Math.max(left.left, right.left),
	);
	const height = Math.max(
		0,
		Math.min(left.top + left.height, right.top + right.height) - Math.max(left.top, right.top),
	);
	return width * height;
};

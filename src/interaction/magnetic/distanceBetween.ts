import type { Point } from "./Point";

export const distanceBetween = (left: Point, right: Point) =>
	Math.hypot(left.x - right.x, left.y - right.y);

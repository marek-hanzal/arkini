import type { RectLike } from "~/play/types";
import type { Point } from "./Point";

export const rectCenter = (rect: RectLike): Point => ({
	x: rect.left + rect.width / 2,
	y: rect.top + rect.height / 2,
});

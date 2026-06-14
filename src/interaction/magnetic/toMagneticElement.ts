import type { RectLike } from "~/play/types";
import { distanceBetween } from "./distanceBetween";
import type { MagneticElement } from "./MagneticElement";
import { rectCenter } from "./rectCenter";
import { rectDistance } from "./rectDistance";
import { rectOverlapArea } from "./rectOverlapArea";

const magneticDropThresholdPx = 30;

export const toMagneticElement = (
	element: HTMLElement,
	dragRect: RectLike,
): MagneticElement | null => {
	const rect = element.getBoundingClientRect();
	const overlapArea = rectOverlapArea(dragRect, rect);
	const distance = rectDistance(dragRect, rect);
	if (overlapArea <= 0 && distance > magneticDropThresholdPx) return null;

	return {
		element,
		overlapArea,
		distance,
		centerDistance: distanceBetween(rectCenter(dragRect), rectCenter(rect)),
	};
};

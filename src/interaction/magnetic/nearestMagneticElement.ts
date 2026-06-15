import type { RectLike } from "~/play/types";
import type { MagneticElement } from "./MagneticElement";
import { toMagneticElement } from "./toMagneticElement";

export const nearestMagneticElement = (
	selector: string,
	dragRect: RectLike,
): MagneticElement | null => {
	const candidates = [
		...document.querySelectorAll<HTMLElement>(selector),
	]
		.map((element) => toMagneticElement(element, dragRect))
		.filter((candidate): candidate is MagneticElement => Boolean(candidate))
		.sort(
			(left, right) =>
				right.overlapArea - left.overlapArea ||
				left.distance - right.distance ||
				left.centerDistance - right.centerDistance,
		);

	return candidates[0] ?? null;
};

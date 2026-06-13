import type { RectLike } from "~/play/types";
import { queryRect } from "~/shared/util/queryRect";

export function inventorySinkRect(
	source: RectLike,
	anchor: RectLike | undefined = queryRect("[data-inventory-summary]"),
): RectLike {
	const size = Math.max(22, Math.min(42, Math.min(source.width, source.height) * 0.55));
	const left = anchor
		? anchor.left + anchor.width / 2 - size / 2
		: window.innerWidth / 2 - size / 2;
	const top = anchor
		? anchor.top + anchor.height / 2 - size / 2
		: window.innerHeight - 72 - size / 2;

	return {
		left,
		top,
		width: size,
		height: size,
	};
}

import { containsPoint } from "~/tile-engine/rect";
import type { TileEngineDrop } from "~/tile-engine/TileEngineDrop.types";

const elementContainsDrop = ({
	dropElement,
	topElement,
}: {
	dropElement: HTMLElement;
	topElement: Element;
}) => dropElement === topElement || dropElement.contains(topElement);

const findTopmostDrop = <TSlot, TTile, TDrop>({
	drops,
	x,
	y,
}: {
	drops: ReadonlyMap<string, TileEngineDrop.Registration<TSlot, TTile, TDrop>>;
	x: number;
	y: number;
}) => {
	const topElements =
		typeof document === "undefined" ? [] : (document.elementsFromPoint?.(x, y) ?? []);

	for (const topElement of topElements) {
		for (const entry of drops.values()) {
			if (
				!elementContainsDrop({
					dropElement: entry.element,
					topElement,
				})
			) {
				continue;
			}

			if (!containsPoint(entry.element.getBoundingClientRect(), x, y)) continue;

			return entry;
		}
	}

	return null;
};

export const resolveDropAtPoint = <TSlot, TTile, TDrop>(
	drops: ReadonlyMap<string, TileEngineDrop.Registration<TSlot, TTile, TDrop>>,
	x: number,
	y: number,
): TileEngineDrop.Resolved<TSlot, TTile, TDrop> | null => {
	const topmostDrop = findTopmostDrop({
		drops,
		x,
		y,
	});

	if (topmostDrop) return topmostDrop;

	for (const entry of drops.values()) {
		if (!containsPoint(entry.element.getBoundingClientRect(), x, y)) continue;

		return entry;
	}

	return null;
};

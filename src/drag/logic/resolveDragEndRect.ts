import type { DragEndEvent } from "@dnd-kit/core";
import type { RectLike } from "~/play/types";

export const resolveDragEndRect = (event: DragEndEvent): RectLike | null => {
	const translated = event.active.rect.current.translated as RectLike | null;
	if (translated) return translated;

	const initial = event.active.rect.current.initial as RectLike | null;
	if (!initial) return null;

	return {
		left: initial.left + event.delta.x,
		top: initial.top + event.delta.y,
		width: initial.width,
		height: initial.height,
	};
};

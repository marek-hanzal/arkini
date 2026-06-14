import type { RectLike } from "~/play/types";
import type { DraggablePayload } from "./DraggablePayload";

export interface MagneticDropContext<
	ItemId extends string = string,
	Source = unknown,
	Overlay = unknown,
> {
	source: DraggablePayload<ItemId, Source, Overlay>;
	dragRect: RectLike;
}

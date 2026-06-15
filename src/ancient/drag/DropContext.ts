import type { DraggablePayload } from "./DraggablePayload";
import type { DroppablePayload } from "./DroppablePayload";

export interface DropContext<
	ItemId extends string = string,
	Source = unknown,
	Target = unknown,
	Overlay = unknown,
> {
	source: DraggablePayload<ItemId, Source, Overlay>;
	target: DroppablePayload<Target> | null;
}

import type { DragEndEvent } from "@dnd-kit/core";
import type { DraggablePayload } from "~/drag/DraggablePayload";
import type { DropContext } from "~/drag/DropContext";
import type { DroppablePayload } from "~/drag/DroppablePayload";
import type { MagneticDropContext } from "~/drag/MagneticDropContext";
import type { RectLike } from "~/play/types";
import { resolveDragEndRect } from "./resolveDragEndRect";

export namespace resolveDropContext {
	export interface Props<ItemId extends string, Source, Target, Overlay> {
		event: DragEndEvent;
		resolveMagneticDropTarget?(
			context: MagneticDropContext<ItemId, Source, Overlay>,
		): DroppablePayload<Target> | null;
	}

	export interface Result<ItemId extends string, Source, Target, Overlay> {
		context: DropContext<ItemId, Source, Target, Overlay> | null;
		dragRect: RectLike | null;
	}
}

export const resolveDropContext = <
	ItemId extends string = string,
	Source = unknown,
	Target = unknown,
	Overlay = unknown,
>({
	event,
	resolveMagneticDropTarget,
}: resolveDropContext.Props<ItemId, Source, Target, Overlay>): resolveDropContext.Result<
	ItemId,
	Source,
	Target,
	Overlay
> => {
	const source = event.active.data.current as
		| DraggablePayload<ItemId, Source, Overlay>
		| undefined;
	const directTarget = (event.over?.data.current as DroppablePayload<Target> | undefined) ?? null;
	const dragRect = resolveDragEndRect(event);
	const magneticTarget =
		source && dragRect
			? (resolveMagneticDropTarget?.({
					source,
					dragRect,
				}) ?? null)
			: null;
	const target = magneticTarget ?? directTarget;

	return {
		context: source
			? {
					source,
					target,
				}
			: null,
		dragRect,
	};
};

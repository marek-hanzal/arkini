import type { DraggableAnimation } from "~/drag/DraggableAnimation";
import type { DraggablePayload } from "~/drag/DraggablePayload";
import type { DroppablePayload } from "~/drag/DroppablePayload";
import type { FlyerKind, DragSource, DropTarget, VisualMeta } from "~/play/types";

export namespace dragToTargetAnimation {
	export interface Props {
		source: DraggablePayload<string, DragSource, VisualMeta>;
		target: DroppablePayload<DropTarget>;
		kind?: FlyerKind;
		overlay?: VisualMeta;
	}
}

export const dragToTargetAnimation = ({
	source,
	target,
	kind = "move",
	overlay,
}: dragToTargetAnimation.Props): DraggableAnimation<string, FlyerKind, VisualMeta> => ({
	itemId: source.itemId,
	fromDrag: true,
	toNodeId: target.targetNodeId,
	kind,
	overlay: {
		...source.overlay,
		...overlay,
	},
});

import type { DraggablePayload } from "~/drag/DraggablePayload";
import { inventoryContainerNodeId } from "~/inventory/inventoryContainerNodeId";
import type { DragSource, VisualMeta } from "~/play/types";

export namespace getDragBoundaryNodeId {
	export interface Props {
		source: DraggablePayload<string, DragSource, VisualMeta>;
	}
}

export const getDragBoundaryNodeId = ({ source }: getDragBoundaryNodeId.Props) =>
	source.source.kind === "inventory" ? inventoryContainerNodeId : undefined;

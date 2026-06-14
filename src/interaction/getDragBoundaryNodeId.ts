import { boardContainerNodeId } from "~/board/boardContainerNodeId";
import type { DraggablePayload } from "~/drag/hook/useDraggableControl";
import { inventoryContainerNodeId } from "~/inventory/inventoryContainerNodeId";
import type { DragSource, VisualMeta } from "~/play/types";

export namespace getDragBoundaryNodeId {
	export interface Props {
		source: DraggablePayload<string, DragSource, VisualMeta>;
	}
}

export const getDragBoundaryNodeId = ({ source }: getDragBoundaryNodeId.Props) =>
	source.source.kind === "board" ? boardContainerNodeId : inventoryContainerNodeId;

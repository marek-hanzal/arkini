import { queryPaddingBoxRect } from "~/shared/util/queryPaddingBoxRect";
import { queryRect } from "~/shared/util/queryRect";

export namespace rectForNode {
	export interface Props {
		nodeId: string | undefined;
	}
}

const shouldUsePlacementBox = (nodeId: string) =>
	nodeId.startsWith("board-cell:") || nodeId.startsWith("inventory-slot:");

export const rectForNode = ({ nodeId }: rectForNode.Props) => {
	if (!nodeId) return null;
	const selector = `[data-drag-node-id="${nodeId}"]`;
	return shouldUsePlacementBox(nodeId)
		? (queryPaddingBoxRect(selector) ?? null)
		: (queryRect(selector) ?? null);
};

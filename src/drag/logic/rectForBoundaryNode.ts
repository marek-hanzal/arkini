import { queryRect } from "~/shared/util/queryRect";

export namespace rectForBoundaryNode {
	export interface Props {
		nodeId: string | null | undefined;
	}
}

export const rectForBoundaryNode = ({ nodeId }: rectForBoundaryNode.Props) => {
	if (!nodeId) return null;
	return (
		queryRect(`[data-drag-boundary-id="${nodeId}"]`) ??
		queryRect(`[data-drag-node-id="${nodeId}"]`) ??
		null
	);
};

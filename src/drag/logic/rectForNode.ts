import { queryRect } from "~/shared/util/queryRect";

export namespace rectForNode {
	export interface Props {
		nodeId: string | undefined;
	}
}

export const rectForNode = ({ nodeId }: rectForNode.Props) => {
	if (!nodeId) return null;
	return queryRect(`[data-drag-node-id="${nodeId}"]`) ?? null;
};

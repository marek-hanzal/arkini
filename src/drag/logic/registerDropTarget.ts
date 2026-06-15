import { dropTargetPayloadByNodeId } from "~/drag/logic/dropTargetPayloadByNodeId";

export namespace registerDropTarget {
	export interface Props<TPayload = unknown> {
		nodeId: string;
		payload: TPayload;
	}
}

/**
 * Registers drop metadata for targets that live outside the current TileEngine
 * instance, for example the inventory bottom navigation button.
 *
 * TileEngine keeps its own slot targets locally. This small registry covers only
 * cross-surface targets that still need pointer hit testing during a drag.
 */
export const registerDropTarget = <TPayload = unknown>({
	nodeId,
	payload,
}: registerDropTarget.Props<TPayload>) => {
	dropTargetPayloadByNodeId.set(nodeId, payload);

	return () => {
		if (dropTargetPayloadByNodeId.get(nodeId) === payload) {
			dropTargetPayloadByNodeId.delete(nodeId);
		}
	};
};

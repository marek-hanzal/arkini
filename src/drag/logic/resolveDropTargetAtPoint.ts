import { dropTargetNodeFromElement } from "~/drag/logic/dropTargetNodeFromElement";
import { dropTargetPayloadByNodeId } from "~/drag/logic/dropTargetPayloadByNodeId";

export namespace resolveDropTargetAtPoint {
	export interface Props {
		x: number;
		y: number;
	}

	export interface Result<TPayload = unknown> {
		nodeId: string;
		payload: TPayload;
	}
}

/** Resolves the first registered cross-surface drop target under a viewport point. */
export const resolveDropTargetAtPoint = <TPayload = unknown>({
	x,
	y,
}: resolveDropTargetAtPoint.Props): resolveDropTargetAtPoint.Result<TPayload> | null => {
	for (const element of document.elementsFromPoint(x, y)) {
		const node = dropTargetNodeFromElement(element);
		const nodeId = node?.dataset.tileEngineDropTargetId;
		if (!nodeId || !dropTargetPayloadByNodeId.has(nodeId)) continue;

		return {
			nodeId,
			payload: dropTargetPayloadByNodeId.get(nodeId) as TPayload,
		};
	}

	return null;
};

/**
 * GPT:FIX
 *
 * This whole file is a mess.
 *
 * It should be separated into individual functions with namespaces.
 *
 * Also docs are missing, so we don't know what that crap does.
 */

export namespace registerDropTarget {
	export interface Props<TPayload = unknown> {
		nodeId: string;
		payload: TPayload;
	}
}

const dropTargetByNodeId = new Map<string, unknown>();

export const registerDropTarget = <TPayload = unknown>({
	nodeId,
	payload,
}: registerDropTarget.Props<TPayload>) => {
	dropTargetByNodeId.set(nodeId, payload);

	return () => {
		if (dropTargetByNodeId.get(nodeId) === payload) dropTargetByNodeId.delete(nodeId);
	};
};

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

const targetNodeFrom = (element: Element) => {
	if (!(element instanceof HTMLElement)) return null;
	return element.closest<HTMLElement>("[data-tile-engine-drop-target-id]");
};

/**
 * GPT:FIX
 *
 * Why we've drag and tile engine stuff here as we're not in tile engine?
 */
export const resolveDropTargetAtPoint = <TPayload = unknown>({
	x,
	y,
}: resolveDropTargetAtPoint.Props): resolveDropTargetAtPoint.Result<TPayload> | null => {
	for (const element of document.elementsFromPoint(x, y)) {
		const node = targetNodeFrom(element);
		const nodeId = node?.dataset.tileEngineDropTargetId;
		if (!nodeId) continue;

		const payload = dropTargetByNodeId.get(nodeId) as TPayload | undefined;
		if (payload) {
			return {
				nodeId,
				payload,
			};
		}
	}

	return null;
};

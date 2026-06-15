import { useEffect } from "react";
import { registerDropTarget } from "~/drag/logic/dropTargetRegistry";

export namespace useDropTargetRegistration {
	export interface Props<TPayload = unknown> {
		nodeId?: string;
		payload?: TPayload;
		disabled?: boolean;
	}
}

/**
 * GPT:FIX
 *
 * Write docs, why this exists and what we're using it for.
 */
export const useDropTargetRegistration = <TPayload = unknown>({
	nodeId,
	payload,
	disabled = false,
}: useDropTargetRegistration.Props<TPayload>) => {
	useEffect(() => {
		if (disabled || !nodeId || !payload) return;
		return registerDropTarget({
			nodeId,
			payload,
		});
	}, [
		disabled,
		nodeId,
		payload,
	]);
};

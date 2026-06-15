import { useEffect } from "react";
import { registerDropTarget } from "~/drag/logic/registerDropTarget";

export namespace useDropTargetRegistration {
	export interface Props<TPayload = unknown> {
		nodeId?: string;
		payload?: TPayload;
		disabled?: boolean;
	}
}

/** Registers a cross-surface drop target while its DOM node is mounted. */
export const useDropTargetRegistration = <TPayload = unknown>({
	nodeId,
	payload,
	disabled = false,
}: useDropTargetRegistration.Props<TPayload>) => {
	useEffect(() => {
		if (disabled || !nodeId || payload === undefined) return;
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

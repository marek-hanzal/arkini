import { useCallback, useRef, useSyncExternalStore } from "react";

import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { useGameSession } from "~/v1/ui/session/GameSessionContext";

/** Selects a stable projection from the latest committed runtime snapshot. */
export const useRuntimeSelector = <Selected>(
	selector: (runtime: RuntimeSchema.Type) => Selected,
	isEqual: (left: Selected, right: Selected) => boolean = Object.is,
): Selected => {
	const session = useGameSession();
	const last = useRef<
		| {
				root: RuntimeSchema.Type;
				selected: Selected;
				selector: (runtime: RuntimeSchema.Type) => Selected;
		  }
		| undefined
	>(undefined);
	const getSnapshot = useCallback(() => {
		const root = session.getSnapshot();
		const previous = last.current;
		if (previous?.root === root && previous.selector === selector) return previous.selected;
		const selected = selector(root);
		if (previous !== undefined && isEqual(previous.selected, selected)) {
			last.current = {
				root,
				selected: previous.selected,
				selector,
			};
			return previous.selected;
		}
		last.current = {
			root,
			selected,
			selector,
		};
		return selected;
	}, [
		isEqual,
		selector,
		session,
	]);

	return useSyncExternalStore(session.subscribe, getSnapshot, getSnapshot);
};

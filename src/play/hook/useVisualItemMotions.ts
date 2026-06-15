import { useCallback, useMemo, useReducer } from "react";
import type { RectLike, VisualTransitionKind } from "~/play/types";

export type VisualItemMotionPriority = "normal" | "raised";

export interface VisualItemMotion {
	from: RectLike;
	to: RectLike;
	priority: VisualItemMotionPriority;
	nonce: number;
	kind?: VisualTransitionKind;
}

export const visualBoardItemKey = (boardItemId: string) => `board:${boardItemId}`;
export const visualInventoryStackKey = (stackId: string) => `inventory-stack:${stackId}`;
export const visualInventorySlotKey = (slotIndex: number) => `inventory-slot:${slotIndex}`;

export namespace useVisualItemMotions {
	export interface StageEntry {
		key: string;
		from: RectLike;
		to: RectLike;
		priority?: VisualItemMotionPriority;
		kind?: VisualTransitionKind;
	}

	export interface State {
		motions: Record<string, VisualItemMotion>;
		stage(entries: readonly StageEntry[]): void;
		settle(key: string, nonce: number): void;
		clear(): void;
	}
}

type VisualItemMotionState = {
	motions: Record<string, VisualItemMotion>;
	nextNonce: number;
};

type VisualItemMotionAction =
	| {
			type: "stage";
			entries: readonly useVisualItemMotions.StageEntry[];
	  }
	| {
			type: "settle";
			key: string;
			nonce: number;
	  }
	| {
			type: "clear";
	  };

const initialState: VisualItemMotionState = {
	motions: {},
	nextNonce: 1,
};

const reduceVisualItemMotion = (
	state: VisualItemMotionState,
	action: VisualItemMotionAction,
): VisualItemMotionState => {
	if (action.type === "clear") {
		if (Object.keys(state.motions).length === 0) return state;

		return {
			...state,
			motions: {},
		};
	}

	if (action.type === "settle") {
		const current = state.motions[action.key];
		if (!current || current.nonce !== action.nonce) return state;

		const { [action.key]: _settled, ...motions } = state.motions;
		return {
			...state,
			motions,
		};
	}

	if (!action.entries.length) return state;

	const motions = {
		...state.motions,
	};
	let nextNonce = state.nextNonce;

	for (const entry of action.entries) {
		motions[entry.key] = {
			from: entry.from,
			to: entry.to,
			priority: entry.priority ?? "raised",
			nonce: nextNonce,
			kind: entry.kind,
		};
		nextNonce += 1;
	}

	return {
		motions,
		nextNonce,
	};
};

/**
 * UI-only motion registry for real item actors.
 *
 * Durable board/inventory data may update before the player has seen the
 * movement. This tiny reducer keeps a temporary visual origin and priority for
 * moved or spawned actors until the Motion transition settles, so query
 * invalidation can stay optimistic without making tiles blink back and forth
 * like a haunted vending machine.
 */
export function useVisualItemMotions(): useVisualItemMotions.State {
	const [state, dispatch] = useReducer(reduceVisualItemMotion, initialState);
	const stage = useCallback((entries: readonly useVisualItemMotions.StageEntry[]) => {
		if (!entries.length) return;
		dispatch({
			type: "stage",
			entries,
		});
	}, []);
	const settle = useCallback((key: string, nonce: number) => {
		dispatch({
			type: "settle",
			key,
			nonce,
		});
	}, []);
	const clear = useCallback(
		() =>
			dispatch({
				type: "clear",
			}),
		[],
	);

	return useMemo(
		() => ({
			motions: state.motions,
			stage,
			settle,
			clear,
		}),
		[
			clear,
			settle,
			stage,
			state.motions,
		],
	);
}

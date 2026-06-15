import { useMachine } from "@xstate/react";
import { useCallback, useMemo } from "react";
import {
	visualItemMotionMachine,
	type VisualItemMotion,
	type VisualItemMotionPriority,
} from "~/play/logic/visualItemMotionMachine";
import type { RectLike, VisualTransitionKind } from "~/play/types";

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

/**
 * GPT:FIX
 *
 * Write docs, why this crap exists here and what it's used for.
 */
export function useVisualItemMotions(): useVisualItemMotions.State {
	const [state, send] = useMachine(visualItemMotionMachine);
	const stage = useCallback(
		(entries: readonly useVisualItemMotions.StageEntry[]) => {
			if (!entries.length) return;
			send({
				type: "STAGE",
				entries,
			});
		},
		[
			send,
		],
	);
	const settle = useCallback(
		(key: string, nonce: number) => {
			send({
				type: "SETTLED",
				key,
				nonce,
			});
		},
		[
			send,
		],
	);
	const clear = useCallback(
		() =>
			send({
				type: "CLEAR",
			}),
		[
			send,
		],
	);

	return useMemo(
		() => ({
			motions: state.context.motions,
			stage,
			settle,
			clear,
		}),
		[
			clear,
			settle,
			stage,
			state.context.motions,
		],
	);
}

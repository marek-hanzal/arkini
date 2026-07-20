import { Exit } from "effect";
import { useCallback } from "react";

import { useGameEngine } from "~/bridge/game/useGameEngine";
import { useRuntimeSelector } from "~/bridge/runtime/useRuntimeSelector";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readItemDetailStatusFx } from "~/engine/item-detail/read/readItemDetailStatusFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace useItemDetailStatus {
	export type OperationalState = readItemDetailStatusFx.OperationalState;

	export type Projection =
		| {
				readonly kind: "available";
				readonly itemId: IdSchema.Type;
				readonly title: string;
				readonly state: OperationalState;
		  }
		| {
				readonly kind: "unavailable";
		  };
}

const unavailable = {
	kind: "unavailable",
} as const satisfies useItemDetailStatus.Projection;

const sameState = (
	left: useItemDetailStatus.OperationalState,
	right: useItemDetailStatus.OperationalState,
) => {
	if (left.kind !== right.kind) return false;
	if (left.kind === "stored" && right.kind === "stored") {
		return left.location === right.location;
	}
	if (left.kind === "paused" && right.kind === "paused") {
		if (left.reason.kind !== right.reason.kind) return false;
		if (left.reason.kind === "passive-storage" && right.reason.kind === "passive-storage") {
			return left.reason.location === right.reason.location;
		}
	}
	return true;
};

const sameProjection = (
	left: useItemDetailStatus.Projection,
	right: useItemDetailStatus.Projection,
) => {
	if (left.kind !== right.kind) return false;
	if (left.kind === "unavailable" || right.kind === "unavailable") return true;
	return (
		left.itemId === right.itemId &&
		left.title === right.title &&
		sameState(left.state, right.state)
	);
};

/** Projects one exact line owner's current player-facing operational condition. */
export const useItemDetailStatus = (itemId: IdSchema.Type): useItemDetailStatus.Projection => {
	const game = useGameEngine();
	const selector = useCallback(
		(runtime: RuntimeSchema.Type): useItemDetailStatus.Projection => {
			const exit = game.read(
				readItemDetailStatusFx({
					itemId,
					runtime,
				}),
			);
			if (Exit.isFailure(exit) || exit.value.kind === "unavailable") return unavailable;
			const status = exit.value;
			return {
				kind: "available",
				itemId: status.itemId,
				title: status.title,
				state: status.state,
			};
		},
		[
			game,
			itemId,
		],
	);
	return useRuntimeSelector(selector, sameProjection);
};

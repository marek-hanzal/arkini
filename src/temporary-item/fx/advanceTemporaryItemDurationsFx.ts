import { Effect } from "effect";

import { isInstantGameplayEnabledFn } from "~/game-runtime/read/fn/isInstantGameplayEnabledFn";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import { SimulationStepMs } from "~/simulation-time/constant/SimulationStepMs";

interface AdvanceTemporaryItemDurationsProps {
	items: readonly RuntimeItemSchema.Type[];
	runtime: RuntimeSchema.Type;
}

/** Decrements only temporary identities observed at the current step boundary. */
export const advanceTemporaryItemDurationsFx = Effect.fn("advanceTemporaryItemDurationsFx")(
	function* ({ items, runtime }: AdvanceTemporaryItemDurationsProps) {
		let draft = runtime;
		const instantGameplay = isInstantGameplayEnabledFn({
			runtime,
		});

		for (const snapshotItem of items) {
			const liveItem = draft.items.find((candidate) => candidate.id === snapshotItem.id);
			if (
				liveItem === undefined ||
				liveItem.item.type !== TypeSchema.enum.Temporary ||
				liveItem.remainingDurationMs === undefined ||
				liveItem.remainingDurationMs === 0
			) {
				continue;
			}

			const advanced = {
				...liveItem,
				remainingDurationMs: instantGameplay
					? 0
					: Math.max(0, liveItem.remainingDurationMs - SimulationStepMs),
			} satisfies RuntimeItemSchema.Type;
			draft = {
				...draft,
				items: draft.items.map((candidate) =>
					candidate.id === advanced.id ? advanced : candidate,
				),
			};
		}

		return draft;
	},
);

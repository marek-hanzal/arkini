import { Effect } from "effect";

import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { RuntimeTimePolicyFx } from "~/engine/tick/context/RuntimeTimePolicyFx";
import { TickStepMs } from "~/engine/tick/TickStepMs";
import { ItemEnumSchema } from "~/engine/item/schema/ItemEnumSchema";

export namespace advanceTemporaryItemDurationsFx {
	export interface Props {
		items: readonly RuntimeItemSchema.Type[];
		runtime: RuntimeSchema.Type;
	}
}

/** Decrements only temporary identities observed at the current step boundary. */
export const advanceTemporaryItemDurationsFx = Effect.fn("advanceTemporaryItemDurationsFx")(
	function* ({ items, runtime }: advanceTemporaryItemDurationsFx.Props) {
		let draft = runtime;
		const timePolicy = yield* RuntimeTimePolicyFx;
		const instantGameplay = yield* timePolicy.completeTimedWorkInstantly({
			runtime,
		});

		for (const snapshotItem of items) {
			if (
				!(yield* timePolicy.shouldAdvanceTemporaryItem({
					item: snapshotItem,
					runtime,
				}))
			)
				continue;
			const liveItem = draft.items.find((candidate) => candidate.id === snapshotItem.id);
			if (
				liveItem === undefined ||
				liveItem.item.type !== ItemEnumSchema.enum.Temporary ||
				liveItem.remainingDurationMs === undefined ||
				liveItem.remainingDurationMs === 0
			) {
				continue;
			}

			const advanced = {
				...liveItem,
				remainingDurationMs: instantGameplay
					? 0
					: Math.max(0, liveItem.remainingDurationMs - TickStepMs),
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

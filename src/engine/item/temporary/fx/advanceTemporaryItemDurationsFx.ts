import { Effect } from "effect";

import { isInstantGameplayEnabledFx } from "~/engine/cheat/read/isInstantGameplayEnabledFx";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { TickStepMs } from "~/engine/tick/TickStepMs";
import { TypeSchema } from "~/engine/item/schema/TypeSchema";

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
		const instantGameplay = yield* isInstantGameplayEnabledFx({
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

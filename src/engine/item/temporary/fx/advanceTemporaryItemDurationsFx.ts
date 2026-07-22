import { Effect } from "effect";

import { isInstantGameplayEnabledFx } from "~/engine/cheat/read/isInstantGameplayEnabledFx";
import { reviseRuntimeItemFx } from "~/engine/runtime/fx/reviseRuntimeItemFx";
import type { RuntimeItemSchema } from "~/engine/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
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
		const instantGameplay = yield* isInstantGameplayEnabledFx({ runtime });

		for (const snapshotItem of items) {
			const liveItem = draft.items.find((candidate) => candidate.id === snapshotItem.id);
			if (
				liveItem === undefined ||
				liveItem.item.type !== ItemEnumSchema.enum.Temporary ||
				liveItem.remainingDurationMs === undefined ||
				liveItem.remainingDurationMs === 0
			) {
				continue;
			}

			const revised = yield* reviseRuntimeItemFx({
				item: {
					...liveItem,
					remainingDurationMs: instantGameplay
						? 0
						: Math.max(0, liveItem.remainingDurationMs - TickStepMs),
				},
			});
			draft = {
				...draft,
				items: draft.items.map((candidate) =>
					candidate.id === revised.id ? revised : candidate,
				),
			};
		}

		return draft;
	},
);

import { Effect } from "effect";

import { reviseRuntimeItemFx } from "~/v1/runtime/fx/reviseRuntimeItemFx";
import type { RuntimeItemSchema } from "~/v1/runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import { TickStepMs } from "~/v1/tick/TickStepMs";

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

		for (const snapshotItem of items) {
			const liveItem = draft.items.find((candidate) => candidate.id === snapshotItem.id);
			if (
				liveItem === undefined ||
				liveItem.item.type !== "temporary" ||
				liveItem.remainingDurationMs === undefined ||
				liveItem.remainingDurationMs === 0
			) {
				continue;
			}

			const revised = yield* reviseRuntimeItemFx({
				item: {
					...liveItem,
					remainingDurationMs: Math.max(0, liveItem.remainingDurationMs - TickStepMs),
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

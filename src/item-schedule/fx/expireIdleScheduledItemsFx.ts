import { Effect } from "effect";
import { attemptScheduledItemExpiryFx } from "~/item-schedule/fx/attemptScheduledItemExpiryFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";

/** Settles exhausted identities in stable order after accepted work has had its dispatch pass. */
export const expireIdleScheduledItemsFx = Effect.fn("expireIdleScheduledItemsFx")(function* (
	runtime: RuntimeSchema.Type,
) {
	let draft = runtime;
	const events: GameEventSchema.Type[] = [];
	const ids = runtime.items
		.filter((item) => item.schedule?.remainingDurationMs === 0)
		.map((item) => item.id)
		.sort();
	for (const itemId of ids) {
		if (
			!draft.items.some((item) => item.id === itemId) ||
			draft.jobs.some((job) => job.ownerItemId === itemId)
		)
			continue;
		const attempt = yield* attemptScheduledItemExpiryFx({
			itemId,
			runtime: draft,
		});
		if (attempt.type === "blocked") continue;
		draft = attempt.runtime;
		events.push(...attempt.events);
	}
	return {
		runtime: draft,
		events,
	};
});

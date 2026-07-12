import { Effect, PubSub } from "effect";

import { GameEventBusFx } from "~/v1/event/internal/GameEventBusFx";
import type { GameEventSchema } from "~/v1/event/schema/GameEventSchema";

export namespace publishGameEventsFx {
	export interface Props {
		events: readonly [
			GameEventSchema.Type,
			...GameEventSchema.Type[],
		];
	}
}

/** Publishes one ordered best-effort batch after the corresponding runtime commit. */
export const publishGameEventsFx = Effect.fn("publishGameEventsFx")(function* ({
	events,
}: publishGameEventsFx.Props) {
	const bus = yield* GameEventBusFx;
	yield* PubSub.publish(bus, {
		events: [
			...events,
		],
	});
});

import { Context, type Effect } from "effect";

import type { TickSchema } from "~/v1/tick/schema/TickSchema";

export interface TickFxService {
	readonly read: Effect.Effect<TickSchema.Type>;
	readonly set: (tick: TickSchema.Type) => Effect.Effect<void>;
}

/** Shared current tick snapshot backed by the game layer. */
export class TickFx extends Context.Tag("TickFx")<TickFx, TickFxService>() {
	//
}

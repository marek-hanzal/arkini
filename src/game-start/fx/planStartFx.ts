import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { Effect } from "effect";
import { applyBoardTemplateRuntimeFx } from "~/board-template/fx/applyBoardTemplateRuntimeFx";
import { assertRuntimeFx } from "~/game-runtime/fx/assertRuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { StartSchema } from "~/game-start/schema/StartSchema";

/** Uses the same destructive template operation as later gameplay, then validates one complete start. */
export const planStartFx = Effect.fn("planStartFx")(function* ({
	runtime,
	start,
}: {
	readonly runtime: RuntimeSchema.Type;
	readonly start: StartSchema.Type;
}) {
	let draft = {
		...runtime,
		currentSpace: start.currentSpace,
	};
	const events: GameEventSchema.Type[] = [];
	for (const assignment of start.spaces) {
		const applied = yield* applyBoardTemplateRuntimeFx({
			runtime: draft,
			...assignment,
		});
		draft = applied.runtime;
		events.push(...applied.events);
	}
	return {
		runtime: yield* assertRuntimeFx({
			runtime: draft,
		}),
		events,
	};
});

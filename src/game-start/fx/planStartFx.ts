import type { EngineFact } from "~/game-event/type/EngineFact";
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
	const facts: EngineFact[] = [];
	for (const assignment of start.spaces) {
		const applied = yield* applyBoardTemplateRuntimeFx({
			runtime: draft,
			...assignment,
		});
		draft = applied.runtime;
		facts.push({
			type: "template:applied",
			effect: {
				type: "template",
				space: assignment.space,
				templateUid: assignment.templateUid,
				removed: applied.removed,
			},
		});
	}
	return {
		runtime: yield* assertRuntimeFx({
			runtime: draft,
		}),
		facts,
	};
});

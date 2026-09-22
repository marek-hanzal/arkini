import { Effect } from "effect";
import { resolveItemFx } from "~/item-resolution/fx/resolveItemFx";
import { createRuntimeItemFx } from "~/game-runtime/fx/createRuntimeItemFx";
import { createRuntimeItemIdFx } from "~/game-runtime/fx/createRuntimeItemIdFx";
import { assertRuntimeFx } from "~/game-runtime/fx/assertRuntimeFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { StartSchema } from "~/game-start/schema/StartSchema";
/** Builds one exact identity per authored Board cell, then validates the complete runtime. */
export const planStartFx = Effect.fn("planStartFx")(function* ({
	runtime,
	start,
}: {
	readonly runtime: RuntimeSchema.Type;
	readonly start: StartSchema.Type;
}) {
	const items = yield* Effect.forEach(start.board, (entry) =>
		Effect.gen(function* () {
			return yield* createRuntimeItemFx({
				id: yield* createRuntimeItemIdFx(),
				item: yield* resolveItemFx({
					itemId: entry.itemId,
				}),
				location: {
					scope: "board",
					space: entry.space,
					position: {
						x: entry.x,
						y: entry.y,
					},
				},
			});
		}),
	);
	const next = {
		...runtime,
		currentSpace: start.currentSpace,
		items: [
			...runtime.items,
			...items,
		],
	};
	yield* assertRuntimeFx({
		runtime: next,
	});
	return next;
});

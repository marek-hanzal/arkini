import { Array, Effect, Option, pipe } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { CheatInventoryConsumedGameEventSchema } from "~/engine/event/schema/CheatInventoryConsumedGameEventSchema";
import { ItemNotFoundError } from "~/engine/item/error/ItemNotFoundError";
import { ItemNotOnBoardError } from "~/engine/item/error/ItemNotOnBoardError";
import { assertOwnerIdleFx } from "~/engine/job/fx/assertOwnerIdleFx";
import { assertRevisionFx } from "~/engine/revision/fx/assertRevisionFx";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { assertNonJobScopeFx } from "~/engine/runtime/fx/assertNonJobScopeFx";
import { removeRuntimeItemFx } from "~/engine/runtime/fx/removeRuntimeItemFx";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { CrossSpaceBoardOperationError } from "~/engine/space/error/CrossSpaceBoardOperationError";
import { CheatInventorySameItemError } from "~/engine/utility/error/CheatInventorySameItemError";
import { CheatInventoryTargetInvalidError } from "~/engine/utility/error/CheatInventoryTargetInvalidError";

export namespace consumeItemIntoCheatInventoryFx {
	export interface Props {
		sourceItemId: IdSchema.Type;
		sourceRevision: RevisionSchema.Type;
		targetItemId: IdSchema.Type;
		targetRevision: RevisionSchema.Type;
	}
}

/** Atomically consumes one complete board source through a live cheat-inventory sink. */
export const consumeItemIntoCheatInventoryFx = Effect.fn("consumeItemIntoCheatInventoryFx")(
	function* ({
		sourceItemId,
		sourceRevision,
		targetItemId,
		targetRevision,
	}: consumeItemIntoCheatInventoryFx.Props) {
		return yield* modifyRuntimeFx((runtime) =>
			Effect.gen(function* () {
				if (sourceItemId === targetItemId) {
					return yield* Effect.fail(
						new CheatInventorySameItemError({
							itemId: sourceItemId,
						}),
					);
				}

				const source = pipe(
					runtime.items,
					Array.findFirst((item) => item.id === sourceItemId),
					Option.getOrUndefined,
				);
				if (source === undefined) {
					return yield* Effect.fail(
						new ItemNotFoundError({
							itemId: sourceItemId,
						}),
					);
				}

				const target = pipe(
					runtime.items,
					Array.findFirst((item) => item.id === targetItemId),
					Option.getOrUndefined,
				);
				if (target === undefined) {
					return yield* Effect.fail(
						new ItemNotFoundError({
							itemId: targetItemId,
						}),
					);
				}

				yield* assertRevisionFx({
					actualRevision: source.revision,
					entityId: source.id,
					expectedRevision: sourceRevision,
				});
				yield* assertRevisionFx({
					actualRevision: target.revision,
					entityId: target.id,
					expectedRevision: targetRevision,
				});
				yield* assertNonJobScopeFx({
					item: source,
				});
				yield* assertNonJobScopeFx({
					item: target,
				});

				if (source.location.scope !== "board") {
					return yield* Effect.fail(
						new ItemNotOnBoardError({
							itemId: source.id,
							location: source.location,
						}),
					);
				}
				if (target.location.scope !== "board") {
					return yield* Effect.fail(
						new ItemNotOnBoardError({
							itemId: target.id,
							location: target.location,
						}),
					);
				}
				if (source.location.space !== target.location.space) {
					return yield* Effect.fail(
						new CrossSpaceBoardOperationError({
							fromSpace: source.location.space,
							toSpace: target.location.space,
						}),
					);
				}
				if (target.item.type !== "cheat:inventory") {
					return yield* Effect.fail(
						new CheatInventoryTargetInvalidError({
							targetItemId: target.id,
							targetCanonicalItemId: target.item.id,
						}),
					);
				}

				yield* assertOwnerIdleFx({
					ownerItemId: source.id,
					runtime,
				});
				const nextRuntime = yield* removeRuntimeItemFx({
					item: source,
					runtime,
				});
				const event = {
					type: "cheat-inventory:consumed",
					sourceItemId: source.id,
					sourceCanonicalItemId: source.item.id,
					targetItemId: target.id,
					targetCanonicalItemId: target.item.id,
					quantity: source.quantity,
				} satisfies CheatInventoryConsumedGameEventSchema.Type;

				return [
					source,
					nextRuntime,
					[
						event,
					],
				] as const;
			}),
		);
	},
);

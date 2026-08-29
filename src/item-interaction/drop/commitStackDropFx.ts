import { Effect } from "effect";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { PositiveIntegerSchema } from "~/engine/common/schema/PositiveIntegerSchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { removeRuntimeItemIdentityFx } from "~/game-runtime/fx/removeRuntimeItemIdentityFx";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import { modifyRuntimeFx } from "~/game-runtime/internal/modifyRuntimeFx";
import type { GridRuntimeItemSchema } from "~/game-runtime/schema/GridRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { DropItemRejectedReason } from "~/item-interaction/DropItemResult";
import type { DropItemResult } from "~/item-interaction/DropItemResult";
import { DropItemResultKind } from "~/item-interaction/DropItemResult";
import { makeDropRejectedResultFn } from "~/item-interaction/drop/fn/makeDropRejectedResultFn";
import { projectDropTransferActorFn } from "~/item-interaction/drop/fn/projectDropTransferActorFn";
import { StackItemsUnavailableError } from "~/item-interaction/error/StackItemsUnavailableError";
import { readDropItemStackRejectedReasonFn } from "~/item-interaction/read/fn/readDropItemStackRejectedReasonFn";
import { readItemStackResolutionFn } from "~/item-interaction/read/fn/readItemStackResolutionFn";

interface StackItemsResult {
	readonly transferredQuantity: PositiveIntegerSchema.Type;
	readonly sourceBefore: GridRuntimeItemSchema.Type;
	readonly sourceAfter?: GridRuntimeItemSchema.Type;
	readonly targetBefore: GridRuntimeItemSchema.Type;
	readonly targetAfter: GridRuntimeItemSchema.Type;
}

const stackItemsFx = Effect.fn("stackItemsFx")(function* (props: commitStackDropFx.Props) {
	return yield* modifyRuntimeFx((runtime) =>
		Effect.gen(function* () {
			const resolution = readItemStackResolutionFn({
				runtime,
				...props,
			});
			if (resolution.kind !== "available") {
				return yield* Effect.fail(
					new StackItemsUnavailableError({
						sourceItemId: props.sourceItemId,
						targetItemId: props.targetItemId,
						reason: resolution.reason,
					}),
				);
			}

			const sourceRemainingQuantity =
				resolution.source.quantity - resolution.transferredQuantity;
			const sourceAfter =
				sourceRemainingQuantity === 0
					? undefined
					: yield* reviseRuntimeItemFx({
							item: {
								...resolution.source,
								quantity: sourceRemainingQuantity,
							} satisfies RuntimeItemSchema.Type,
						});
			const sourceRuntime =
				sourceAfter === undefined
					? yield* removeRuntimeItemIdentityFx({
							item: resolution.source,
							runtime,
						})
					: ({
							...runtime,
							items: runtime.items.map((item) =>
								item.id === props.sourceItemId ? sourceAfter : item,
							),
						} satisfies RuntimeSchema.Type);
			const targetAfter = yield* reviseRuntimeItemFx({
				item: {
					...resolution.target,
					quantity: resolution.target.quantity + resolution.transferredQuantity,
				} satisfies RuntimeItemSchema.Type,
			});
			return [
				{
					transferredQuantity: resolution.transferredQuantity,
					sourceBefore: resolution.source,
					...(sourceAfter === undefined
						? {}
						: {
								sourceAfter,
							}),
					targetBefore: resolution.target,
					targetAfter,
				} satisfies StackItemsResult,
				{
					...sourceRuntime,
					items: sourceRuntime.items.map((item) =>
						item.id === props.targetItemId ? targetAfter : item,
					),
				} satisfies RuntimeSchema.Type,
			] as const;
		}),
	);
});

export namespace commitStackDropFx {
	export interface Props {
		readonly sourceItemId: IdSchema.Type;
		readonly sourceRevision: RevisionSchema.Type;
		readonly sourceLocation: GridLocationSchema.Type;
		readonly targetItemId: IdSchema.Type;
		readonly targetRevision: RevisionSchema.Type;
		readonly targetLocation: GridLocationSchema.Type;
	}

	export type Result = DropItemResult;
}

/** Commits one exact pure-stack transfer and normalizes both actor identities. */
export const commitStackDropFx = Effect.fn("commitStackDropFx")(function* ({
	sourceItemId,
	sourceRevision,
	sourceLocation,
	targetItemId,
	targetRevision,
	targetLocation,
}: commitStackDropFx.Props) {
	return yield* stackItemsFx({
		sourceItemId,
		sourceRevision,
		sourceLocation,
		targetItemId,
		targetRevision,
		targetLocation,
	}).pipe(
		Effect.map((result): commitStackDropFx.Result => {
			const source = projectDropTransferActorFn({
				after: result.sourceAfter,
				before: result.sourceBefore,
			});
			return {
				kind: DropItemResultKind.Stack,
				transferredQuantity: result.transferredQuantity,
				source,
				target: {
					itemId: result.targetBefore.id,
					canonicalItemId: result.targetBefore.item.id,
					previousRevision: result.targetBefore.revision,
					previousLocation: result.targetBefore.location,
					previousQuantity: result.targetBefore.quantity,
					current: {
						itemId: result.targetAfter.id,
						canonicalItemId: result.targetAfter.item.id,
						revision: result.targetAfter.revision,
						location: result.targetAfter.location,
						quantity: result.targetAfter.quantity,
					},
				},
			};
		}),
		Effect.catchTag("StackItemsUnavailableError", (error) =>
			Effect.succeed(
				makeDropRejectedResultFn({
					reason: readDropItemStackRejectedReasonFn({
						reason: error.reason,
					}),
					sourceItemId,
					targetItemId,
				}),
			),
		),
		Effect.catchTags({
			ItemNotFoundError: (error) =>
				Effect.succeed(
					makeDropRejectedResultFn({
						reason:
							error.itemId === targetItemId
								? DropItemRejectedReason.StaleTarget
								: DropItemRejectedReason.StaleSource,
						sourceItemId,
						targetItemId,
					}),
				),
			JobOwnerBusyError: () =>
				Effect.succeed(
					makeDropRejectedResultFn({
						reason: DropItemRejectedReason.Blocked,
						sourceItemId,
						targetItemId,
					}),
				),
		}),
	);
});

import { destroyInventoriesFx } from "~/space/fx/destroyInventoriesFx";
import { Effect } from "effect";
import { TemplateNotFoundError } from "~/board-template/error/TemplateNotFoundError";
import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import { createRuntimeItemFx } from "~/game-runtime/fx/createRuntimeItemFx";
import { createRuntimeItemIdFx } from "~/game-runtime/fx/createRuntimeItemIdFx";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import { readRuntimeOwnershipClosureFn } from "~/game-runtime/fn/readRuntimeOwnershipClosureFn";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import { readPhysicalRootOriginFn } from "~/item-location/fn/readPhysicalRootOriginFn";
import { resolveItemFx } from "~/item-resolution/fx/resolveItemFx";
import { readDeliveryTravelDurationMsFn } from "~/production-delivery/fn/readDeliveryTravelDurationMsFn";

export namespace applyBoardTemplateRuntimeFx {
	export interface Props {
		readonly runtime: RuntimeSchema.Type;
		/** Pre-settlement ancestry for owners/jobs already detached from the current draft. */
		readonly ownershipRuntime?: RuntimeSchema.Type;
		readonly space: number;
		readonly templateUid: IdSchema.Type;
	}
	export interface Result {
		readonly runtime: RuntimeSchema.Type;
		readonly removed: readonly RuntimeItemSchema.Type[];
	}
}

/** A board owns its physical roots and complete input/job trees. */
const readDiscardedIdsFn = (runtime: RuntimeSchema.Type, space: number) => {
	const rootItemIds = new Set(
		runtime.items
			.filter(({ location }) => readPhysicalRootOriginFn(location)?.space === space)
			.map((item) => item.id),
	);
	const { ownerItemIds: itemIds, jobIds } = readRuntimeOwnershipClosureFn({
		rootItemIds,
		items: runtime.items,
		jobs: runtime.jobs,
	});
	return {
		itemIds,
		jobIds,
	};
};

/** Plans destructive replacement of one space. No refunds, completion outputs or expiry effects run. */
export const applyBoardTemplateRuntimeFx = Effect.fn("applyBoardTemplateRuntimeFx")(function* ({
	runtime,
	ownershipRuntime = runtime,
	space,
	templateUid,
}: applyBoardTemplateRuntimeFx.Props) {
	const config = yield* GameConfigFx;
	const template = config.templates?.find((entry) => entry.uid === templateUid);
	if (template === undefined)
		return yield* Effect.fail(
			new TemplateNotFoundError({
				templateUid,
			}),
		);
	const currentIds = new Set(runtime.items.map((item) => item.id));
	const currentJobIds = new Set(runtime.jobs.map((job) => job.id));
	const discarded = readDiscardedIdsFn(
		{
			...runtime,
			items: [
				...runtime.items,
				...ownershipRuntime.items.filter((item) => !currentIds.has(item.id)),
			],
			jobs: [
				...runtime.jobs,
				...ownershipRuntime.jobs.filter((job) => !currentJobIds.has(job.id)),
			],
		},
		space,
	);
	const removed = runtime.items.filter((item) => discarded.itemIds.has(item.id));
	const items: RuntimeItemSchema.Type[] = [];
	for (const item of runtime.items) {
		if (discarded.itemIds.has(item.id)) continue;
		const location = item.location;
		// A producer can travel after local autofill admission; its remote lease still belongs home.
		if (
			location.scope === "delivery" &&
			location.phase === "outbound" &&
			discarded.itemIds.has(location.target.ownerItemId)
		) {
			const owner =
				runtime.items.find((entry) => entry.id === location.target.ownerItemId) ??
				ownershipRuntime.items.find((entry) => entry.id === location.target.ownerItemId);
			const returnFrom = owner?.location.scope === "board" ? owner.location : location.origin;
			items.push(
				yield* reviseRuntimeItemFx({
					item: {
						...item,
						location: {
							scope: "delivery",
							phase: "returning",
							generation: location.generation + 1,
							origin: location.origin,
							returnFrom,
							remainingDurationMs: readDeliveryTravelDurationMsFn({
								from: returnFrom,
								to: location.origin,
							}),
						},
					},
				}),
			);
		} else items.push(item);
	}
	for (const cell of template.board) {
		items.push(
			yield* createRuntimeItemFx({
				id: yield* createRuntimeItemIdFx(),
				item: yield* resolveItemFx({
					itemUid: cell.itemUid,
				}),
				location: {
					scope: "board",
					space,
					position: {
						x: cell.x,
						y: cell.y,
					},
				},
			}),
		);
	}
	const result: applyBoardTemplateRuntimeFx.Result = {
		runtime: {
			...runtime,
			items,
			templateUidBySpace: {
				...runtime.templateUidBySpace,
				[space]: templateUid,
			},
			jobs: runtime.jobs.filter((job) => !discarded.jobIds.has(job.id)),
			jobQueue: runtime.jobQueue.filter(
				(request) => !discarded.itemIds.has(request.ownerItemId),
			),
			defaultLineByOwnerItemId: Object.fromEntries(
				Object.entries(runtime.defaultLineByOwnerItemId).filter(
					([id]) => !discarded.itemIds.has(id),
				),
			),
		},
		removed,
	};
	const destroyed = yield* destroyInventoriesFx({
		removedItems: removed,
		runtime: result.runtime,
		ownershipRuntime,
	});
	return {
		runtime: destroyed.runtime,
		removed: [
			...removed,
			...destroyed.removed,
		],
	} satisfies applyBoardTemplateRuntimeFx.Result;
});

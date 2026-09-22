import { Effect } from "effect";
import { match } from "ts-pattern";

import { readOutcomePlacementItemEventsFx } from "~/game-event/fx/readOutcomePlacementItemEventsFx";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { ItemStatefulError } from "~/game-runtime/error/ItemStatefulError";
import { resolveItemFx } from "~/item-resolution/fx/resolveItemFx";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { MergeSchema } from "~/item-merge/schema/MergeSchema";
import { SourceActionSchema } from "~/item-merge/schema/SourceActionSchema";
import { TargetEffectSchema } from "~/item-merge/schema/TargetEffectSchema";
import { assertOwnerIdleFx } from "~/production-job/fx/assertOwnerIdleFx";
import { spendActionUnitsFx } from "~/production-action/fx/spendActionUnitsFx";
import { resolveOutcomeTableFx } from "~/outcome/fx/resolveOutcomeTableFx";
import { readBoardRuntimeItemByIdFx } from "~/game-runtime/fx/readBoardRuntimeItemByIdFx";
import { applyOutcomeTableFx } from "~/outcome/fx/applyOutcomeTableFx";
import { createRuntimeItemFx } from "~/game-runtime/fx/createRuntimeItemFx";
import { discardRuntimeItemOwnedStateFx } from "~/game-runtime/fx/discardRuntimeItemOwnedStateFx";
import { removeRuntimeItemFx } from "~/game-runtime/fx/removeRuntimeItemFx";
import { removeRuntimeItemIdentityFx } from "~/game-runtime/fx/removeRuntimeItemIdentityFx";
import type { BoardRuntimeItemSchema } from "~/game-runtime/schema/BoardRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

/** Merge reuse and replacement cannot discard identity-owned state. */
const hasMergeIdentityStateFn = ({
	item,
	runtime,
}: {
	readonly item: BoardRuntimeItemSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) => {
	if (
		item.schedule !== undefined ||
		item.remainingUnits !== undefined ||
		Object.hasOwn(runtime.defaultLineByOwnerItemId, item.id)
	)
		return true;
	return item.item.lines.some(
		(line) =>
			runtime.items.some(
				({ location }) =>
					(location.scope === "input" &&
						location.ownerItemId === item.id &&
						location.lineId === line.id) ||
					(location.scope === "delivery" &&
						location.phase === "outbound" &&
						location.target.ownerItemId === item.id &&
						location.target.lineId === line.id),
			) ||
			runtime.jobs.some((job) => job.ownerItemId === item.id && job.lineId === line.id) ||
			runtime.jobQueue.some(
				(request) => request.ownerItemId === item.id && request.lineId === line.id,
			),
	);
};

const applyMergeSourceActionFx = Effect.fn("applyMergeSourceActionFx")(function* ({
	action,
	actionId,
	runtime,
	source,
}: {
	readonly action: SourceActionSchema.Type;
	readonly actionId: string;
	readonly runtime: RuntimeSchema.Type;
	readonly source: BoardRuntimeItemSchema.Type;
}) {
	yield* assertOwnerIdleFx({
		ownerItemId: source.id,
		runtime,
	});
	if (action === SourceActionSchema.enum.Spend) {
		const spent = yield* spendActionUnitsFx({
			actionId,
			cost: 1,
			itemId: source.id,
			ownerItemId: source.id,
			runtime,
		});
		return {
			events: spent.events,
			runtime: spent.runtime,
		} satisfies {
			readonly events: readonly GameEventSchema.Type[];
			readonly runtime: RuntimeSchema.Type;
		};
	}

	if (action === SourceActionSchema.enum.Use) {
		const hasState = hasMergeIdentityStateFn({
			item: source,
			runtime,
		});
		if (hasState) {
			return yield* Effect.fail(
				new ItemStatefulError({
					itemId: source.id,
				}),
			);
		}
	}

	if (action === SourceActionSchema.enum.Use)
		return {
			events: [],
			runtime,
		};
	const withoutOwnedState =
		action === SourceActionSchema.enum.Consume
			? yield* discardRuntimeItemOwnedStateFx({
					ownerItemId: source.id,
					runtime,
				})
			: {
					runtime,
					events: [],
				};
	const removed = yield* removeRuntimeItemIdentityFx({
		item: source,
		runtime: withoutOwnedState.runtime,
	});
	const draft = removed.runtime;
	const events = [
		...withoutOwnedState.events,
		...removed.events,
	];

	return {
		events,

		runtime: draft,
	} satisfies {
		readonly events: readonly GameEventSchema.Type[];
		readonly runtime: RuntimeSchema.Type;
	};
});

const resolveMergeReplacementUnitsFx = Effect.fn("resolveMergeReplacementUnitsFx")(function* ({
	resultItem,
	runtime,
	target,
}: {
	readonly resultItem: ItemSchema.Type;
	readonly runtime: RuntimeSchema.Type;
	readonly target: BoardRuntimeItemSchema.Type;
}) {
	const hasOtherState = hasMergeIdentityStateFn({
		item: {
			...target,
			remainingUnits: undefined,
			schedule: undefined,
		},
		runtime,
	});
	if (hasOtherState) {
		return yield* Effect.fail(
			new ItemStatefulError({
				itemId: target.id,
			}),
		);
	}
	if (target.remainingUnits === undefined) return {};

	const targetCapacity = target.item.units?.amount;
	const resultCapacity = resultItem.units?.amount;
	// A unitless replacement ends the old supply; only finite results inherit spent units.
	if (resultCapacity === undefined) return {};
	if (targetCapacity === undefined) {
		return yield* Effect.fail(
			new ItemStatefulError({
				itemId: target.id,
			}),
		);
	}
	const remainingUnits = resultCapacity - (targetCapacity - target.remainingUnits);
	if (remainingUnits <= 0) {
		return yield* Effect.fail(
			new ItemStatefulError({
				itemId: target.id,
			}),
		);
	}

	return remainingUnits === resultCapacity
		? {}
		: {
				remainingUnits,
			};
});

const applyMergeTargetEffectFx = Effect.fn("applyMergeTargetEffectFx")(function* ({
	actionId,
	ownerItemId,
	rule,
	runtime,
	target,
}: {
	readonly actionId: string;
	readonly ownerItemId: string;
	readonly rule: MergeSchema.Type;
	readonly runtime: RuntimeSchema.Type;
	readonly target: BoardRuntimeItemSchema.Type;
}) {
	return yield* match(rule)
		.with(
			{
				effect: TargetEffectSchema.enum.Spend,
			},
			() =>
				spendActionUnitsFx({
					actionId,
					cost: 1,
					itemId: target.id,
					ownerItemId,
					runtime,
				}),
		)
		.with(
			{
				effect: TargetEffectSchema.enum.Keep,
			},
			() =>
				Effect.succeed({
					events: [],
					runtime,
				}),
		)
		.with(
			{
				effect: TargetEffectSchema.enum.Remove,
			},
			() =>
				Effect.gen(function* () {
					yield* assertOwnerIdleFx({
						ownerItemId: target.id,
						runtime,
					});
					return yield* removeRuntimeItemFx({
						item: target,
						runtime,
					});
				}),
		)
		.with(
			{
				effect: TargetEffectSchema.enum.Replace,
			},
			({ result }) =>
				Effect.gen(function* () {
					yield* assertOwnerIdleFx({
						ownerItemId: target.id,
						runtime,
					});
					const resultItem = yield* resolveItemFx({
						itemId: result,
					});
					const replacementUnits = yield* resolveMergeReplacementUnitsFx({
						resultItem,
						runtime,
						target,
					});
					const replacement = yield* createRuntimeItemFx({
						id: target.id,
						item: resultItem,
						location: target.location,
						...replacementUnits,
					});
					const replacementWithSequence = {
						...replacement,
						mergeSequence: target.mergeSequence,
					};
					return {
						events: [],
						runtime: {
							...runtime,
							items: runtime.items.map((item) =>
								item.id === target.id ? replacementWithSequence : item,
							),
						},
					};
				}),
		)
		.exhaustive();
});

interface ApplyMergeRuntimeProps {
	readonly rule: MergeSchema.Type;
	readonly ruleIndex: number;
	readonly runtime: RuntimeSchema.Type;
	readonly source: BoardRuntimeItemSchema.Type;
	readonly target: BoardRuntimeItemSchema.Type;
}

interface ApplyMergeRuntimeResult {
	readonly events: readonly GameEventSchema.Type[];
	readonly runtime: RuntimeSchema.Type;
}

/** Applies one resolved directional merge to an immutable candidate runtime. */
export const applyMergeRuntimeFx = Effect.fn("applyMergeRuntimeFx")(function* ({
	rule,
	ruleIndex,
	runtime,
	source,
	target,
}: ApplyMergeRuntimeProps) {
	const sourceAction = yield* applyMergeSourceActionFx({
		action: rule.action,
		actionId: `merge:${ruleIndex}:${source.mergeSequence ?? 0}`,
		runtime,
		source,
	});
	// Resolve the target against the draft after source side effects.
	const currentTarget = yield* readBoardRuntimeItemByIdFx({
		itemId: target.id,
		runtime: sourceAction.runtime,
	});
	const targetEffect = yield* applyMergeTargetEffectFx({
		actionId: `merge:${ruleIndex}:target:${source.mergeSequence ?? 0}`,
		ownerItemId: source.id,
		rule,
		runtime: sourceAction.runtime,
		target: currentTarget,
	});
	let draft = targetEffect.runtime;
	const events = [
		...sourceAction.events,
		...targetEffect.events,
	];
	const targetDisappeared = rule.effect === TargetEffectSchema.enum.Remove;

	if (rule.outcome === undefined) {
		if (targetDisappeared) {
			events.push({
				type: GameEventEnumSchema.enum.ItemDisappeared,
				itemId: target.id,
				canonicalItemId: target.item.id,
				location: target.location,
			});
		}
		return {
			events,
			runtime: draft,
		} satisfies ApplyMergeRuntimeResult;
	}
	const outcome = yield* resolveOutcomeTableFx({
		ownerItemId: source.id,
		origin: source.location,
		outcome: rule.outcome,
	});
	const [placement, withOutcome] = yield* applyOutcomeTableFx({
		outcome,
		runtime: draft,
	});
	const placementEvents = yield* readOutcomePlacementItemEventsFx({
		originItemId: source.id,
		placement,
	});
	events.push(...placementEvents);
	if (targetDisappeared && placementEvents.length === 0) {
		events.push({
			type: GameEventEnumSchema.enum.ItemDisappeared,
			itemId: target.id,
			canonicalItemId: target.item.id,
			location: target.location,
		});
	}
	draft = withOutcome;
	return {
		events,
		runtime: draft,
	} satisfies ApplyMergeRuntimeResult;
});

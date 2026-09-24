import { GameConfigFx } from "~/game-config/context/GameConfigFx";
import { readBoardSizeFn } from "~/game-runtime/fn/readBoardSizeFn";
import { resolveGeneratedSpaceFx } from "~/space/fx/resolveGeneratedSpaceFx";
import { PreviousSpaceUnavailableError } from "~/item-merge/error/PreviousSpaceUnavailableError";
import { relocateBoardItemFx } from "~/item-placement/fx/relocateBoardItemFx";
import { Effect } from "effect";
import { match } from "ts-pattern";

import type { EngineFact } from "~/game-event/type/EngineFact";
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
						location.lineUid === line.uid) ||
					(location.scope === "delivery" &&
						location.phase === "outbound" &&
						location.target.ownerItemId === item.id &&
						location.target.lineUid === line.uid),
			) ||
			runtime.jobs.some((job) => job.ownerItemId === item.id && job.lineUid === line.uid) ||
			runtime.jobQueue.some(
				(request) => request.ownerItemId === item.id && request.lineUid === line.uid,
			),
	);
};

const applyMergeSourceActionFx = Effect.fn("applyMergeSourceActionFx")(function* ({
	action,
	actionId,
	runtime,
	source,
}: {
	readonly action: Exclude<SourceActionSchema.Type, "space">;
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
			facts: spent.facts,
			runtime: spent.runtime,
		} satisfies {
			readonly facts: readonly EngineFact[];
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
			facts: [],
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
		facts: events,

		runtime: draft,
	} satisfies {
		readonly facts: readonly EngineFact[];
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
					facts: [],
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
					const removed = yield* removeRuntimeItemFx({
						item: target,
						runtime,
					});
					return {
						facts: removed.events,
						runtime: removed.runtime,
					};
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
						itemUid: result,
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
						generatedSpace: target.generatedSpace,
					};
					return {
						facts: [],
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
	readonly facts: readonly EngineFact[];
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
	const owner = rule.action === "space" ? target : source;
	const sourceAction = yield* rule.action === "space"
		? Effect.gen(function* () {
				const generated =
					typeof rule.space === "object"
						? yield* resolveGeneratedSpaceFx({
								ownerItemId: owner.id,
								templateUid: rule.space.templateUid,
								runtime,
							})
						: undefined;
				const space =
					typeof rule.space === "object"
						? generated?.space
						: rule.space === "previous"
							? runtime.previousSpace
							: rule.space;
				if (space === undefined) return yield* new PreviousSpaceUnavailableError();
				const destinationRuntime = generated?.runtime ?? runtime;
				const size = readBoardSizeFn({
					config: yield* GameConfigFx,
					runtime: destinationRuntime,
					space,
				});
				const moved = yield* relocateBoardItemFx({
					itemId: source.id,
					originItemId: owner.id,
					runtime: destinationRuntime,
					origin: {
						scope: "board",
						space,
						position: {
							x: Math.floor(size.width / 2),
							y: Math.floor(size.height / 2),
						},
					},
				});
				return {
					facts: [
						...(generated?.initialization === undefined
							? []
							: [
									{
										type: "template:applied",
										effect: generated.initialization,
									} satisfies EngineFact,
								]),
						...moved.events,
					],
					runtime: moved.runtime,
				};
			})
		: applyMergeSourceActionFx({
				action: rule.action,
				actionId: `merge:${ruleIndex}:${owner.mergeSequence ?? 0}`,
				runtime,
				source,
			});
	// A source depletion can reset the Board. Without its target, the authored merge cannot commit.
	const currentTarget = yield* readBoardRuntimeItemByIdFx({
		itemId: target.id,
		runtime: sourceAction.runtime,
	});
	const targetEffect = yield* applyMergeTargetEffectFx({
		actionId: `merge:${ruleIndex}:target:${owner.mergeSequence ?? 0}`,
		ownerItemId: owner.id,
		rule,
		runtime: sourceAction.runtime,
		target: currentTarget,
	});
	let draft = targetEffect.runtime;
	const targetDepleted = targetEffect.facts.some(
		(event) =>
			event.type === "lifecycle:settled" &&
			event.cause === "depleted" &&
			event.itemId === target.id,
	);
	const facts: EngineFact[] = [
		...sourceAction.facts,
		...targetEffect.facts,
	];
	let mergeReplacementItemIds: string[] = [];
	if (rule.outcome !== undefined) {
		const outcome = yield* resolveOutcomeTableFx({
			ownerItemId: owner.id,
			origin: owner.location,
			outcome: rule.outcome,
		});
		const [placement, withOutcome] = yield* applyOutcomeTableFx({
			outcome,
			runtime: draft,
		});
		if (placement.effects.length > 0)
			facts.push({
				type: "outcome:applied",
				originItemId: owner.id,
				effects: placement.effects,
			});
		if (rule.effect === TargetEffectSchema.enum.Remove)
			mergeReplacementItemIds = placement.effects.flatMap((effect) =>
				effect.type === "item" ? effect.placement.spawn.map((spawned) => spawned.id) : [],
			);
		draft = withOutcome;
	}
	if (rule.effect === TargetEffectSchema.enum.Remove && !targetDepleted) {
		facts.push({
			type: "lifecycle:settled",
			cause: "removed",
			itemId: target.id,
			itemUid: target.item.uid,
			location: target.location,
			visible: true,
			replacementItemIds: mergeReplacementItemIds,
		});
	}
	// Relocate only a surviving tool; a Template outcome must never resurrect the old source.
	if (
		rule.action === SourceActionSchema.enum.Use &&
		draft.items.some((item) => item.id === source.id)
	) {
		const dropped = yield* relocateBoardItemFx({
			itemId: source.id,
			origin: target.location,
			originItemId: target.id,
			runtime: draft,
		});
		draft = dropped.runtime;
		facts.push(...dropped.events);
	}
	return {
		facts,
		runtime: draft,
	} satisfies ApplyMergeRuntimeResult;
});

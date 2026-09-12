import { Effect, Option } from "effect";

import { resolveActionEnableFn } from "~/production-action/fn/resolveActionEnableFn";
import { resolveActionInputFx } from "~/production-action/fx/resolveActionInputFx";
import { resolveActionRuleFx } from "~/production-action/fx/resolveActionRuleFx";
import { settleActionUnitsFx } from "~/production-action/fx/settleActionUnitsFx";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/game-value/schema/NonNegativeIntegerSchema";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import type { GameEventSchema } from "~/game-event/schema/GameEventSchema";
import { ItemNotOnGridError } from "~/item-location/error/ItemNotOnGridError";
import type { ActionSchema } from "~/item-action/schema/ActionSchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { isSameGridLocationFn } from "~/item-location/fn/isSameGridLocationFn";
import type { InputRun } from "~/production-input/type/InputRun";
import type { RevisionSchema } from "~/item-revision/schema/RevisionSchema";
import { ItemLocationConflictError } from "~/item-location/error/ItemLocationConflictError";
import { modifyRuntimeFx } from "~/game-runtime/fx/modifyRuntimeFx";
import { modifyRuntimeWithTransitionFx } from "~/game-runtime/fx/modifyRuntimeWithTransitionFx";
import { narrowGridRuntimeItemFn } from "~/game-runtime/fn/narrowGridRuntimeItemFn";
import { readRuntimeItemByIdFx } from "~/game-runtime/fx/readRuntimeItemByIdFx";
import { readRuntimeCommandTargetFx } from "~/game-runtime/fx/readRuntimeCommandTargetFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import { CrossSpaceBoardOperationError } from "~/item-location/error/CrossSpaceBoardOperationError";
import { CurrentSpaceConflictError } from "~/space-action/error/CurrentSpaceConflictError";
import { ItemActionUnavailableError } from "~/item-action/error/ItemActionUnavailableError";

export namespace activateItemActionFx {
	export interface Props {
		currentSpace: NonNegativeIntegerSchema.Type;
		itemId: IdSchema.Type;
		location: GridLocationSchema.Type;
		revision: RevisionSchema.Type;
	}
}

interface ItemActionPlan {
	readonly ownerItemId: IdSchema.Type;
	readonly action: ActionSchema.Type;
	readonly units: ReadonlyArray<InputRun.UnitPlan>;
}

type CurrentSpaceChangedGameEvent = Extract<
	GameEventSchema.Type,
	{
		readonly type: typeof GameEventEnumSchema.enum.CurrentSpaceChanged;
	}
>;

const resolveItemActionFx = Effect.fn("resolveItemActionFx")(function* ({
	itemId,
	runtime,
}: {
	itemId: IdSchema.Type;
	runtime: RuntimeSchema.Type;
}) {
	const runtimeItem = yield* readRuntimeItemByIdFx({
		itemId,
		runtime,
	});
	const owner = Option.getOrUndefined(narrowGridRuntimeItemFn(runtimeItem));
	if (
		owner === undefined ||
		owner.location.scope === "inventory" ||
		owner.item.action === undefined
	) {
		return yield* Effect.fail(
			new ItemActionUnavailableError({
				itemId,
			}),
		);
	}
	if (owner.location.scope === "board" && owner.location.space !== runtime.currentSpace) {
		return yield* Effect.fail(
			new CrossSpaceBoardOperationError({
				fromSpace: owner.location.space,
				toSpace: runtime.currentSpace,
			}),
		);
	}

	const rules = yield* Effect.forEach(owner.item.action.rules, (rule) =>
		resolveActionRuleFx({
			origin: owner.location,
			rule,
		}),
	);
	const enabled = resolveActionEnableFn({
		enable: true,
		rules,
	});
	if (!enabled) {
		return yield* Effect.fail(
			new ItemActionUnavailableError({
				itemId,
			}),
		);
	}

	const reservedUnits = new Map<IdSchema.Type, number>();
	const units: InputRun.UnitPlan[] = [];
	for (const input of owner.item.action.input) {
		const resolution = yield* resolveActionInputFx({
			input,
			ownerItemId: owner.id,
			reservedUnits,
			runtime,
		});
		if (!resolution.resolution.ready || resolution.plan === undefined) {
			return yield* Effect.fail(
				new ItemActionUnavailableError({
					itemId,
				}),
			);
		}
		if (resolution.plan.units !== undefined) {
			units.push(resolution.plan.units);
			reservedUnits.set(
				resolution.plan.units.itemId,
				(reservedUnits.get(resolution.plan.units.itemId) ?? 0) + resolution.plan.units.cost,
			);
		}
	}

	return {
		ownerItemId: owner.id,
		action: owner.item.action,
		units,
	} satisfies ItemActionPlan;
});

const setCurrentSpaceFn = ({
	runtime,
	space,
}: {
	readonly runtime: RuntimeSchema.Type;
	readonly space: NonNegativeIntegerSchema.Type;
}) => {
	if (runtime.currentSpace === space) {
		return {
			events: [] as CurrentSpaceChangedGameEvent[],
			runtime,
		};
	}
	return {
		events: [
			{
				type: GameEventEnumSchema.enum.CurrentSpaceChanged,
				previousSpace: runtime.currentSpace,
				currentSpace: space,
			} satisfies CurrentSpaceChangedGameEvent,
		],
		runtime: {
			...runtime,
			currentSpace: space,
		} satisfies RuntimeSchema.Type,
	};
};

const applyItemActionFx = Effect.fn("applyItemActionFx")(function* ({
	runtime,
	currentSpace,
	itemId,
	location,
	revision,
}: activateItemActionFx.Props & {
	readonly runtime: RuntimeSchema.Type;
}) {
	if (runtime.currentSpace !== currentSpace) {
		return yield* Effect.fail(
			new CurrentSpaceConflictError({
				actualSpace: runtime.currentSpace,
				expectedSpace: currentSpace,
			}),
		);
	}
	const runtimeItem = yield* readRuntimeCommandTargetFx({
		itemId,
		revision,
		runtime,
	});
	const item = Option.getOrUndefined(narrowGridRuntimeItemFn(runtimeItem));
	if (item === undefined) {
		return yield* Effect.fail(
			new ItemNotOnGridError({
				itemId,
				location: runtimeItem.location,
			}),
		);
	}
	if (
		!isSameGridLocationFn({
			left: item.location,
			right: location,
		})
	) {
		return yield* Effect.fail(
			new ItemLocationConflictError({
				itemId,
				expectedLocation: location,
				actualLocation: item.location,
			}),
		);
	}

	const plan = yield* resolveItemActionFx({
		itemId,
		runtime,
	});
	const settlement = yield* settleActionUnitsFx({
		actionId: item.item.id,
		units: plan.units,
		ownerItemId: plan.ownerItemId,
		runtime,
	});
	const navigation = setCurrentSpaceFn({
		runtime: settlement.runtime,
		space: plan.action.type === "space" ? plan.action.space : settlement.runtime.currentSpace,
	});
	return [
		plan.action,
		navigation.runtime,
		[
			...settlement.events,
			...navigation.events,
		],
	] as const;
});

/** Settles one immediate action plan and its result in one engine transaction. */
export const activateItemActionFx = Effect.fn("activateItemActionFx")(
	(props: activateItemActionFx.Props) =>
		modifyRuntimeFx((runtime) =>
			applyItemActionFx({
				...props,
				runtime,
			}),
		),
);

/** Returns the exact transition causally committed by this accepted item action. */
export const activateItemActionWithTransitionFx = Effect.fn("activateItemActionWithTransitionFx")(
	(props: activateItemActionFx.Props) =>
		modifyRuntimeWithTransitionFx((runtime) =>
			applyItemActionFx({
				...props,
				runtime,
			}),
		),
);

import { Effect, Option } from "effect";

import { resolveActionEnableFn } from "~/production-action/fn/resolveActionEnableFn";
import { resolveActionInputFx } from "~/production-action/fx/resolveActionInputFx";
import { resolveActionRuleFx } from "~/production-action/fx/resolveActionRuleFx";
import { settleActionChargesFx } from "~/production-action/fx/settleActionChargesFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { NonNegativeIntegerSchema } from "~/engine/common/schema/NonNegativeIntegerSchema";
import type { CurrentSpaceChangedGameEventSchema } from "~/game-event/schema/CurrentSpaceChangedGameEventSchema";
import { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { ItemNotOnGridError } from "~/engine/item/error/ItemNotOnGridError";
import { TypeSchema } from "~/item-definition/schema/TypeSchema";
import type { GridLocationSchema } from "~/item-location/schema/GridLocationSchema";
import { isSameGridLocationFn } from "~/item-location/fn/isSameGridLocationFn";
import type { InputRun } from "~/production-input/InputRun";
import type { RevisionSchema } from "~/engine/revision/schema/RevisionSchema";
import { ItemLocationConflictError } from "~/engine/runtime/error/ItemLocationConflictError";
import { modifyRuntimeFx } from "~/engine/runtime/internal/modifyRuntimeFx";
import { modifyRuntimeWithTransitionFx } from "~/engine/runtime/internal/modifyRuntimeWithTransitionFx";
import { isGridRuntimeItemFn } from "~/engine/runtime/read/fn/isGridRuntimeItemFn";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import { readValidatedRuntimeItemFx } from "~/engine/runtime/read/readValidatedRuntimeItemFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { CrossSpaceBoardOperationError } from "~/item-location/error/CrossSpaceBoardOperationError";
import { CurrentSpaceConflictError } from "~/space-action/error/CurrentSpaceConflictError";
import { SpaceActionUnavailableError } from "~/space-action/error/SpaceActionUnavailableError";

export namespace activateSpaceItemFx {
	export interface Props {
		currentSpace: NonNegativeIntegerSchema.Type;
		itemId: IdSchema.Type;
		location: GridLocationSchema.Type;
		revision: RevisionSchema.Type;
	}
}

interface SpaceActionPlan {
	readonly ownerItemId: IdSchema.Type;
	readonly space: number;
	readonly charges: ReadonlyArray<InputRun.ChargePlan>;
}

const resolveSpaceActionFx = Effect.fn("resolveSpaceActionFx")(function* ({
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
	const owner = Option.getOrUndefined(isGridRuntimeItemFn(runtimeItem));
	if (owner === undefined || owner.item.type !== TypeSchema.enum.Space) {
		return yield* Effect.fail(
			new SpaceActionUnavailableError({
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

	const rules = yield* Effect.forEach(owner.item.rules, (rule) =>
		resolveActionRuleFx({
			origin: owner.location,
			rule,
		}),
	);
	const enabled = resolveActionEnableFn({
		enable: owner.item.enable,
		rules,
	});
	if (!enabled) {
		return yield* Effect.fail(
			new SpaceActionUnavailableError({
				itemId,
			}),
		);
	}

	const reservedCharges = new Map<IdSchema.Type, number>();
	const charges: InputRun.ChargePlan[] = [];
	for (const input of owner.item.input) {
		const resolution = yield* resolveActionInputFx({
			input,
			ownerItemId: owner.id,
			reservedCharges,
			runtime,
		});
		if (!resolution.resolution.ready || resolution.plan === undefined) {
			return yield* Effect.fail(
				new SpaceActionUnavailableError({
					itemId,
				}),
			);
		}
		if (resolution.plan.charges !== undefined) {
			charges.push(resolution.plan.charges);
			reservedCharges.set(
				resolution.plan.charges.itemId,
				(reservedCharges.get(resolution.plan.charges.itemId) ?? 0) +
					resolution.plan.charges.cost,
			);
		}
	}

	return {
		ownerItemId: owner.id,
		space: owner.item.space,
		charges,
	} satisfies SpaceActionPlan;
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
			events: [] as CurrentSpaceChangedGameEventSchema.Type[],
			runtime,
		};
	}
	return {
		events: [
			{
				type: GameEventEnumSchema.enum.CurrentSpaceChanged,
				previousSpace: runtime.currentSpace,
				currentSpace: space,
			} satisfies CurrentSpaceChangedGameEventSchema.Type,
		],
		runtime: {
			...runtime,
			currentSpace: space,
		} satisfies RuntimeSchema.Type,
	};
};

const applySpaceItemActivationFx = Effect.fn("applySpaceItemActivationFx")(function* ({
	runtime,
	currentSpace,
	itemId,
	location,
	revision,
}: activateSpaceItemFx.Props & {
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
	const runtimeItem = yield* readValidatedRuntimeItemFx({
		itemId,
		revision,
		runtime,
	});
	const item = Option.getOrUndefined(isGridRuntimeItemFn(runtimeItem));
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

	const plan = yield* resolveSpaceActionFx({
		itemId,
		runtime,
	});
	const settlement = yield* settleActionChargesFx({
		actionId: item.item.id,
		charges: plan.charges,
		ownerItemId: plan.ownerItemId,
		runtime,
	});
	const navigation = setCurrentSpaceFn({
		runtime: settlement.runtime,
		space: plan.space,
	});
	return [
		plan.space,
		navigation.runtime,
		[
			...settlement.events,
			...navigation.events,
		],
	] as const;
});

/** Settles one fresh Space action plan and navigation in one engine transaction. */
export const activateSpaceItemFx = Effect.fn("activateSpaceItemFx")(
	(props: activateSpaceItemFx.Props) =>
		modifyRuntimeFx((runtime) =>
			applySpaceItemActivationFx({
				...props,
				runtime,
			}),
		),
);

/** Returns the exact transition causally committed by this accepted Space action. */
export const activateSpaceItemWithTransitionFx = Effect.fn("activateSpaceItemWithTransitionFx")(
	(props: activateSpaceItemFx.Props) =>
		modifyRuntimeWithTransitionFx((runtime) =>
			applySpaceItemActivationFx({
				...props,
				runtime,
			}),
		),
);

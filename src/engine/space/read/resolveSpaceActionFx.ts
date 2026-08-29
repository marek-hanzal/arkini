import { Effect, Option } from "effect";

import { resolveActionEnableFn } from "~/production-action/fn/resolveActionEnableFn";
import { resolveActionInputFx } from "~/production-action/fx/resolveActionInputFx";
import { resolveActionRuleFx } from "~/production-action/fx/resolveActionRuleFx";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { InputRun } from "~/production-input/InputRun";
import { TypeSchema } from "~/engine/item/schema/TypeSchema";
import { isGridRuntimeItemFn } from "~/engine/runtime/read/fn/isGridRuntimeItemFn";
import { readRuntimeItemByIdFx } from "~/engine/runtime/read/readRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";
import { CrossSpaceBoardOperationError } from "~/engine/space/error/CrossSpaceBoardOperationError";
import { SpaceActionUnavailableError } from "~/engine/space/error/SpaceActionUnavailableError";

export namespace resolveSpaceActionFx {
	export interface Plan {
		readonly ownerItemId: IdSchema.Type;
		readonly space: number;
		readonly charges: ReadonlyArray<InputRun.ChargePlan>;
	}
}

/** Resolves one Space activation against a single read-only runtime snapshot. */
export const resolveSpaceActionFx = Effect.fn("resolveSpaceActionFx")(function* ({
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
	} satisfies resolveSpaceActionFx.Plan;
});

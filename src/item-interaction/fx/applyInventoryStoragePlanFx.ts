import { Effect } from "effect";

import { applyPlacementPlanFx } from "~/item-placement/fx/applyPlacementPlanFx";
import type { InventoryStoragePlan } from "~/item-interaction/fx/planInventoryStorageFx";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import type { GridRuntimeItemSchema } from "~/game-runtime/schema/GridRuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

/** Applies one validated Inventory-storage plan to an immutable runtime draft. */
export const applyInventoryStoragePlanFx = Effect.fn("applyInventoryStoragePlanFx")(function* ({
	item,
	plan,
	runtime,
}: {
	readonly item: GridRuntimeItemSchema.Type;
	readonly plan: InventoryStoragePlan;
	readonly runtime: RuntimeSchema.Type;
}) {
	if (plan.kind === "pure") {
		const [, nextRuntime] = yield* applyPlacementPlanFx({
			plan: plan.plan,
			runtime: plan.detachedRuntime,
		});
		return {
			current: null,
			runtime: nextRuntime,
		} as const;
	}
	const revisedItem = yield* reviseRuntimeItemFx({
		item: {
			...item,
			location: plan.location,
		} satisfies GridRuntimeItemSchema.Type,
	});
	return {
		current: revisedItem,
		runtime: {
			...runtime,
			items: runtime.items.map((candidate) =>
				candidate.id === item.id ? revisedItem : candidate,
			),
		} satisfies RuntimeSchema.Type,
	} as const;
});

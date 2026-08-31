import { Effect } from "effect";

import type { InputLocationSchema } from "~/item-location/schema/InputLocationSchema";
import { createRuntimeItemFx } from "~/game-runtime/fx/createRuntimeItemFx";
import { createRuntimeItemIdFx } from "~/game-runtime/fx/createRuntimeItemIdFx";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import type { InputRuntimeItemSchema } from "~/game-runtime/schema/InputRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { planInputMaterialStoreFn } from "../fn/planInputMaterialStoreFn";

export namespace applyInputMaterialStorePlanFx {
	export interface Props<Source extends RuntimeItemSchema.Type> {
		location: InputLocationSchema.Type;
		plan: planInputMaterialStoreFn.Plan;
		runtime: RuntimeSchema.Type;
		source: Source;
	}

	export interface Result<Source extends RuntimeItemSchema.Type> {
		readonly sourceItem?: Source;
		readonly storedItem: InputRuntimeItemSchema.Type;
	}
}

/**
 * Applies one accepted material quantity to an immutable runtime draft.
 */
export const applyInputMaterialStorePlanFx = Effect.fn("applyInputMaterialStorePlanFx")(function* <
	Source extends RuntimeItemSchema.Type,
>({ location, plan, runtime, source }: applyInputMaterialStorePlanFx.Props<Source>) {
	if (plan.quantity === source.quantity) {
		const storedItem = yield* reviseRuntimeItemFx({
			item: {
				...source,
				location,
			} satisfies InputRuntimeItemSchema.Type,
		});
		const nextRuntime = {
			...runtime,
			items: runtime.items.map((item) => {
				return item.id === source.id ? storedItem : item;
			}),
		} satisfies RuntimeSchema.Type;

		const result: applyInputMaterialStorePlanFx.Result<Source> = {
			storedItem,
		};

		return [
			result,
			nextRuntime,
		] as const;
	}

	const sourceItem = yield* reviseRuntimeItemFx({
		item: {
			...source,
			quantity: source.quantity - plan.quantity,
		} satisfies RuntimeItemSchema.Type,
	});
	const storedItem = yield* createRuntimeItemFx({
		id: yield* createRuntimeItemIdFx(),
		item: source.item,
		location,
		quantity: plan.quantity,
	});
	const nextRuntime = {
		...runtime,
		items: [
			...runtime.items.map((item) => {
				return item.id === source.id ? sourceItem : item;
			}),
			storedItem,
		],
	} satisfies RuntimeSchema.Type;

	const result: applyInputMaterialStorePlanFx.Result<Source> = {
		sourceItem,
		storedItem,
	};

	return [
		result,
		nextRuntime,
	] as const;
});

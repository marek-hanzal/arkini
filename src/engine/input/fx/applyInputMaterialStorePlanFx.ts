import { Effect } from "effect";

import type { InputMaterialStoreResultSchema } from "~/engine/input/schema/command/InputMaterialStoreResultSchema";
import type { InputMaterialStorePlanSchema } from "~/engine/input/schema/store/InputMaterialStorePlanSchema";
import type { InputLocationSchema } from "~/engine/location/schema/InputLocationSchema";
import { createRuntimeItemFx } from "~/engine/runtime/fx/createRuntimeItemFx";
import { createRuntimeItemIdFx } from "~/engine/runtime/fx/createRuntimeItemIdFx";
import { reviseRuntimeItemFx } from "~/engine/runtime/fx/reviseRuntimeItemFx";
import type { GridRuntimeItemSchema } from "~/engine/runtime/schema/GridRuntimeItemSchema";
import type { InputRuntimeItemSchema } from "~/engine/runtime/schema/InputRuntimeItemSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace applyInputMaterialStorePlanFx {
	export interface Props {
		location: InputLocationSchema.Type;
		plan: InputMaterialStorePlanSchema.Type;
		runtime: RuntimeSchema.Type;
		source: GridRuntimeItemSchema.Type;
	}
}

/**
 * Applies one accepted material quantity to an immutable runtime draft.
 */
export const applyInputMaterialStorePlanFx = Effect.fn("applyInputMaterialStorePlanFx")(function* ({
	location,
	plan,
	runtime,
	source,
}: applyInputMaterialStorePlanFx.Props) {
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

		const result: InputMaterialStoreResultSchema.Type = {
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
		} satisfies GridRuntimeItemSchema.Type,
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

	const result: InputMaterialStoreResultSchema.Type = {
		sourceItem,
		storedItem,
	};

	return [
		result,
		nextRuntime,
	] as const;
});

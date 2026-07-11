import { Effect } from "effect";

import type { InputMaterialStoreResultSchema } from "~/v1/input/schema/command/InputMaterialStoreResultSchema";
import type { InputMaterialStorePlanSchema } from "~/v1/input/schema/store/InputMaterialStorePlanSchema";
import type { InputLocationSchema } from "~/v1/location/schema/InputLocationSchema";
import { createRuntimeItemIdFx } from "~/v1/runtime/fx/createRuntimeItemIdFx";
import type { GridRuntimeItemSchema } from "~/v1/runtime/schema/GridRuntimeItemSchema";
import type { InputRuntimeItemSchema } from "~/v1/runtime/schema/InputRuntimeItemSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";

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
		const storedItem = {
			...source,
			location,
		} satisfies InputRuntimeItemSchema.Type;
		const nextRuntime = {
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

	const sourceItem = {
		...source,
		quantity: source.quantity - plan.quantity,
	} satisfies GridRuntimeItemSchema.Type;
	const storedItem = {
		id: yield* createRuntimeItemIdFx(),
		item: source.item,
		location,
		quantity: plan.quantity,
	} satisfies InputRuntimeItemSchema.Type;
	const nextRuntime = {
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

import { Effect } from "effect";
import type { InputLocationSchema } from "~/item-location/schema/InputLocationSchema";
import { reviseRuntimeItemFx } from "~/game-runtime/fx/reviseRuntimeItemFx";
import type { InputRuntimeItemSchema } from "~/game-runtime/schema/InputRuntimeItemSchema";
import type { RuntimeItemSchema } from "~/game-runtime/schema/RuntimeItemSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace applyInputMaterialStorePlanFx {
	export interface Props {
		location: InputLocationSchema.Type;
		runtime: RuntimeSchema.Type;
		source: RuntimeItemSchema.Type;
	}
	export interface Result {
		readonly storedItem: InputRuntimeItemSchema.Type;
	}
}

/** Moves the admitted identity and its owned state into one material-input slot. */
export const applyInputMaterialStorePlanFx = Effect.fn("applyInputMaterialStorePlanFx")(function* ({
	location,
	runtime,
	source,
}: applyInputMaterialStorePlanFx.Props) {
	const storedItem = yield* reviseRuntimeItemFx({
		item: {
			...source,
			location,
		} satisfies InputRuntimeItemSchema.Type,
	});
	return [
		{
			storedItem,
		},
		{
			...runtime,
			items: runtime.items.map((item) => (item.id === source.id ? storedItem : item)),
		},
	] as const;
});

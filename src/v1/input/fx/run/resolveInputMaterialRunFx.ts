import { Effect } from "effect";

import { resolveInputMaterialFx } from "~/v1/input/fx/resolveInputMaterialFx";
import type { InputMaterialSchema } from "~/v1/input/schema/InputMaterialSchema";
import type { InputRunResolutionSchema } from "~/v1/input/schema/run/InputRunResolutionSchema";
import type { InputRuntimeItemSchema } from "~/v1/runtime/schema/InputRuntimeItemSchema";
import { planInputMaterialRunFx } from "./planInputMaterialRunFx";

export namespace resolveInputMaterialRunFx {
	export interface Props {
		input: InputMaterialSchema.Type;
		items: InputRuntimeItemSchema.Type[];
	}
}

/**
 * Resolves one material input and prepares its exact allocation when ready.
 */
export const resolveInputMaterialRunFx = Effect.fn("resolveInputMaterialRunFx")(function* ({
	input,
	items,
}: resolveInputMaterialRunFx.Props) {
	const storedQuantity = items.reduce((quantity, item) => {
		return quantity + item.quantity;
	}, 0);
	const resolution = yield* resolveInputMaterialFx({
		input,
		storedQuantity,
	});
	const plan = yield* planInputMaterialRunFx({
		items,
		resolution,
	});

	return {
		resolution,
		plan,
	} satisfies InputRunResolutionSchema.Type;
});

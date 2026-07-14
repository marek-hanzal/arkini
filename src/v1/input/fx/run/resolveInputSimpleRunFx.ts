import { Effect } from "effect";

import { resolveInputSimpleFx } from "~/v1/input/fx/resolveInputSimpleFx";
import type { InputSimpleSchema } from "~/v1/input/schema/InputSimpleSchema";
import type { IdSchema } from "~/v1/common/schema/IdSchema";
import type { RuntimeSchema } from "~/v1/runtime/schema/RuntimeSchema";
import type { InputRunResolutionSchema } from "~/v1/input/schema/run/InputRunResolutionSchema";
import { planInputSimpleRunFx } from "./planInputSimpleRunFx";
import { resolveInputChargeRunFx } from "./resolveInputChargeRunFx";

export namespace resolveInputSimpleRunFx {
	export interface Props {
		input: InputSimpleSchema.Type;
		ownerItemId: IdSchema.Type;
		reservedCharges: ReadonlyMap<IdSchema.Type, number>;
		runtime: RuntimeSchema.Type;
	}
}

/**
 * Resolves and plans one simple line input.
 */
export const resolveInputSimpleRunFx = Effect.fn("resolveInputSimpleRunFx")(function* ({
	input,
	ownerItemId,
	reservedCharges,
	runtime,
}: resolveInputSimpleRunFx.Props) {
	const baseResolution = yield* resolveInputSimpleFx({
		input,
	});
	const charges = yield* resolveInputChargeRunFx({
		charges: input.charges,
		ownerItemId,
		reservedCharges,
		runtime,
	});
	const resolution = {
		...baseResolution,
		ready: charges.ready,
	};
	const plan = charges.ready
		? yield* planInputSimpleRunFx({
				input,
				charges: charges.plan,
			})
		: undefined;

	return {
		resolution,
		plan,
	} satisfies InputRunResolutionSchema.Type;
});

import { Effect } from "effect";
import { match } from "ts-pattern";

import { resolveActionChargeFx } from "~/engine/action/fx/resolveActionChargeFx";
import { resolveActionDepositInputFx } from "~/engine/action/fx/resolveActionDepositInputFx";
import type { ActionInputSchema } from "~/engine/action/schema/ActionInputSchema";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { resolveInputSimpleFx } from "~/engine/input/fx/resolveInputSimpleFx";
import { planInputSimpleRunFx } from "~/engine/input/fx/run/planInputSimpleRunFx";
import { InputEnumSchema } from "~/engine/input/schema/InputEnumSchema";
import type { InputRunResolutionSchema } from "~/engine/input/schema/run/InputRunResolutionSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

/** Resolves one immediate Simple or Deposit requirement without mutating runtime. */
export const resolveActionInputFx = Effect.fn("resolveActionInputFx")(function* ({
	input,
	ownerItemId,
	reservedCharges,
	runtime,
}: {
	readonly input: ActionInputSchema.Type;
	readonly ownerItemId: IdSchema.Type;
	readonly reservedCharges: ReadonlyMap<IdSchema.Type, number>;
	readonly runtime: RuntimeSchema.Type;
}) {
	return yield* match(input)
		.with(
			{
				type: InputEnumSchema.enum.Simple,
			},
			(input) =>
				Effect.gen(function* () {
					const baseResolution = yield* resolveInputSimpleFx({
						input,
					});
					const charges = yield* resolveActionChargeFx({
						charges: input.charges,
						ownerItemId,
						reservedCharges,
						runtime,
					});
					return {
						resolution: {
							...baseResolution,
							ready: charges.ready,
						},
						plan: charges.ready
							? yield* planInputSimpleRunFx({
									input,
									charges: charges.plan,
								})
							: undefined,
					} satisfies InputRunResolutionSchema.Type;
				}),
		)
		.with(
			{
				type: InputEnumSchema.enum.Deposit,
			},
			(input) =>
				resolveActionDepositInputFx({
					input,
					ownerItemId,
					reservedCharges,
					runtime,
				}),
		)
		.exhaustive();
});

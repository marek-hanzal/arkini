import { Effect } from "effect";
import { match } from "ts-pattern";

import { resolveActionChargeFx } from "~/production-action/fx/resolveActionChargeFx";
import { resolveActionDepositInputFx } from "~/production-action/fx/resolveActionDepositInputFx";
import type { InputSchema } from "~/production-action/schema/InputSchema";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { InputRun } from "~/production-input/InputRun";
import { TypeSchema } from "~/production-input/schema/TypeSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

/** Resolves one immediate Simple or Deposit requirement without mutating runtime. */
export const resolveActionInputFx = Effect.fn("resolveActionInputFx")(function* ({
	input,
	ownerItemId,
	reservedCharges,
	runtime,
}: {
	readonly input: InputSchema.Type;
	readonly ownerItemId: IdSchema.Type;
	readonly reservedCharges: ReadonlyMap<IdSchema.Type, number>;
	readonly runtime: RuntimeSchema.Type;
}) {
	return yield* match(input)
		.with(
			{
				type: TypeSchema.enum.Simple,
			},
			(input) =>
				Effect.gen(function* () {
					const charges = yield* resolveActionChargeFx({
						charges: input.charges,
						ownerItemId,
						reservedCharges,
						runtime,
					});
					return {
						resolution: {
							type: input.type,
							ready: charges.ready,
						},
						plan: charges.ready
							? {
									type: input.type,
									charges: charges.plan,
								}
							: undefined,
					} satisfies InputRun.Resolution;
				}),
		)
		.with(
			{
				type: TypeSchema.enum.Deposit,
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

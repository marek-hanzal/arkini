import { Effect } from "effect";
import { match } from "ts-pattern";

import { resolveActionUnitFx } from "~/production-action/fx/resolveActionUnitFx";
import { resolveActionUnitsInputFx } from "~/production-action/fx/resolveActionUnitsInputFx";
import type { InputSchema } from "~/production-action/schema/InputSchema";
import type { IdSchema } from "~/game-value/schema/IdSchema";
import type { InputRun } from "~/production-input/type/InputRun";
import { TypeSchema } from "~/production-input/schema/TypeSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

/** Resolves one immediate Simple or Units requirement without mutating runtime. */
export const resolveActionInputFx = Effect.fn("resolveActionInputFx")(function* ({
	input,
	ownerItemId,
	reservedUnits,
	runtime,
}: {
	readonly input: InputSchema.Type;
	readonly ownerItemId: IdSchema.Type;
	readonly reservedUnits: ReadonlyMap<IdSchema.Type, number>;
	readonly runtime: RuntimeSchema.Type;
}) {
	return yield* match(input)
		.with(
			{
				type: TypeSchema.enum.Simple,
			},
			(input) =>
				Effect.gen(function* () {
					const units = yield* resolveActionUnitFx({
						units: input.units,
						ownerItemId,
						reservedUnits,
						runtime,
					});
					return {
						resolution: {
							type: input.type,
							ready: units.ready,
						},
						plan: units.ready
							? {
									type: input.type,
									units: units.plan,
								}
							: undefined,
					} satisfies InputRun.Resolution;
				}),
		)
		.with(
			{
				type: TypeSchema.enum.Units,
			},
			(input) =>
				resolveActionUnitsInputFx({
					input,
					ownerItemId,
					reservedUnits,
					runtime,
				}),
		)
		.exhaustive();
});

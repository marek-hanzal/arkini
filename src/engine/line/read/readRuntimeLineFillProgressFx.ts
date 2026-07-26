import { Effect } from "effect";
import { match, P } from "ts-pattern";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { InputEnumSchema } from "~/engine/input/schema/InputEnumSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import { readQuantityBoundsFx } from "~/engine/quantity/fx/readQuantityBoundsFx";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readRuntimeLineFillProgressFx {
	export interface Props {
		readonly line: LineSchema.Type;
		readonly ownerItemId: IdSchema.Type;
		readonly runtime: RuntimeSchema.Type;
	}
}

/**
 * Reads normalized material fill for one exact runtime line.
 *
 * Authored capacity above the required minimum does not advance progress. Once
 * the line owns an active job, its consumed inputs remain visually complete
 * until the job resolves.
 */
export const readRuntimeLineFillProgressFx = Effect.fn("readRuntimeLineFillProgressFx")(function* ({
	line,
	ownerItemId,
	runtime,
}: readRuntimeLineFillProgressFx.Props) {
	const active = runtime.jobs.some(
		(job) => job.ownerItemId === ownerItemId && job.lineId === line.id,
	);
	if (active) return 1;

	const fills = yield* Effect.forEach(line.input, (input, inputIndex) =>
		match(input)
			.with(
				{
					type: InputEnumSchema.enum.Materials,
				},
				(materialInput) =>
					Effect.gen(function* () {
						const required = yield* readQuantityBoundsFx({
							quantity: materialInput.quantity,
						});
						const storedQuantity = runtime.items.reduce((total, item) => {
							if (item.location.scope !== LocationScopeEnumSchema.enum.Input) {
								return total;
							}
							return item.location.ownerItemId === ownerItemId &&
								item.location.lineId === line.id &&
								item.location.inputIndex === inputIndex
								? total + item.quantity
								: total;
						}, 0);

						return {
							filled: Math.min(storedQuantity, required.min),
							required: required.min,
						};
					}),
			)
			.with(
				{
					type: P.union(InputEnumSchema.enum.Deposit, InputEnumSchema.enum.Simple),
				},
				() => Effect.succeed(null),
			)
			.exhaustive(),
	);
	const materialFills = fills.filter((fill) => fill !== null);
	const requiredQuantity = materialFills.reduce((total, fill) => total + fill.required, 0);
	if (requiredQuantity === 0) return 0;
	const filledQuantity = materialFills.reduce((total, fill) => total + fill.filled, 0);

	return Math.min(1, filledQuantity / requiredQuantity);
});

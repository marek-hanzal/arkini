import { match, P } from "ts-pattern";

import type { IdSchema } from "~/game-config/schema/IdSchema";
import { TypeSchema } from "~/production-input/schema/TypeSchema";
import type { LineSchema } from "~/production-line/schema/LineSchema";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";

export namespace readRuntimeLineFillProgressFn {
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
export const readRuntimeLineFillProgressFn = ({
	line,
	ownerItemId,
	runtime,
}: readRuntimeLineFillProgressFn.Props) => {
	const active = runtime.jobs.some(
		(job) => job.ownerItemId === ownerItemId && job.lineId === line.id,
	);
	if (active) return 1;

	const fills = line.input.map((input, inputIndex) =>
		match(input)
			.with(
				{
					type: TypeSchema.enum.Materials,
				},
				(materialInput) => {
					const required = materialInput.quantity;
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
				},
			)
			.with(
				{
					type: P.union(TypeSchema.enum.Deposit, TypeSchema.enum.Simple),
				},
				() => null,
			)
			.exhaustive(),
	);
	const materialFills = fills.filter((fill) => fill !== null);
	const requiredQuantity = materialFills.reduce((total, fill) => total + fill.required, 0);
	if (requiredQuantity === 0) return 0;
	const filledQuantity = materialFills.reduce((total, fill) => total + fill.filled, 0);

	return Math.min(1, filledQuantity / requiredQuantity);
};

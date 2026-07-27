import { Effect } from "effect";
import { match } from "ts-pattern";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemDetailLines } from "~/engine/item-detail/read/ItemDetailLines";
import { readItemDetailChargeKeyFx } from "~/engine/item-detail/read/readItemDetailChargeKeyFx";
import { readItemDetailDepositAvailableChargesFx } from "~/engine/item-detail/read/readItemDetailDepositAvailableChargesFx";
import { readItemDetailQuantityBoundsFx } from "~/engine/item-detail/read/readItemDetailQuantityBoundsFx";
import { readItemDetailSelectorKeyFx } from "~/engine/item-detail/read/readItemDetailSelectorKeyFx";
import type { InputRunResolutionSchema } from "~/engine/input/schema/run/InputRunResolutionSchema";
import { InputEnumSchema } from "~/engine/input/schema/InputEnumSchema";
import type { InputSchema } from "~/engine/input/schema/InputSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readItemDetailInputsFx {
	export interface Props {
		readonly configured: readonly InputSchema.Type[];
		readonly lineId: IdSchema.Type;
		readonly ownerItemId: IdSchema.Type;
		readonly resolved?: readonly InputRunResolutionSchema.Type[];
		readonly runtime: RuntimeSchema.Type;
	}
}

/** Aggregates one line's authored and resolved inputs into their visible Item Detail groups. */
export const readItemDetailInputsFx = Effect.fn("readItemDetailInputsFx")(function* ({
	configured,
	lineId,
	ownerItemId,
	resolved,
	runtime,
}: readItemDetailInputsFx.Props) {
	const materials = new Map<string, ItemDetailLines.MaterialInput>();
	const deposits = new Map<string, ItemDetailLines.DepositInput>();
	const simple = new Map<string, ItemDetailLines.SimpleInput>();

	for (const [inputIndex, input] of configured.entries()) {
		const resolution = resolved?.[inputIndex]?.resolution;
		yield* match(input)
			.with(
				{
					type: InputEnumSchema.enum.Materials,
				},
				(materialInput) =>
					Effect.gen(function* () {
						const required = yield* readItemDetailQuantityBoundsFx(
							materialInput.quantity,
						);
						const storedItems = runtime.items.filter(
							(item) =>
								item.location.scope === LocationScopeEnumSchema.enum.Input &&
								item.location.ownerItemId === ownerItemId &&
								item.location.lineId === lineId &&
								item.location.inputIndex === inputIndex,
						);
						const storedQuantity =
							resolution?.type === InputEnumSchema.enum.Materials
								? resolution.storedQuantity
								: storedItems.reduce((total, item) => total + item.quantity, 0);
						const maxStoredQuantity =
							resolution?.type === InputEnumSchema.enum.Materials
								? resolution.maxStoredQuantity
								: required.max + materialInput.capacity;
						const missingQuantity = Math.max(0, required.min - storedQuantity);
						const availableCapacity = Math.max(0, maxStoredQuantity - storedQuantity);
						const selectorKey = yield* readItemDetailSelectorKeyFx(
							materialInput.selector,
						);
						const chargeKey = yield* readItemDetailChargeKeyFx(materialInput.charges);
						const key = `${selectorKey}:${materialInput.mode}:${chargeKey}`;
						const previous = materials.get(key);
						materials.set(key, {
							kind: "materials",
							selector: materialInput.selector,
							mode: materialInput.mode,
							required: {
								min: (previous?.required.min ?? 0) + required.min,
								max: (previous?.required.max ?? 0) + required.max,
							},
							storedQuantity: (previous?.storedQuantity ?? 0) + storedQuantity,
							maxStoredQuantity:
								(previous?.maxStoredQuantity ?? 0) + maxStoredQuantity,
							missingQuantity: (previous?.missingQuantity ?? 0) + missingQuantity,
							availableCapacity:
								(previous?.availableCapacity ?? 0) + availableCapacity,
							ready:
								(previous?.ready ?? true) &&
								(resolution?.ready ?? storedQuantity >= required.min),
							...(materialInput.charges === undefined
								? {}
								: {
										charges: materialInput.charges,
									}),
						});
					}),
			)
			.with(
				{
					type: InputEnumSchema.enum.Deposit,
				},
				(depositInput) =>
					Effect.gen(function* () {
						const selectorKey = yield* readItemDetailSelectorKeyFx(
							depositInput.query.selector,
						);
						const chargeKey = yield* readItemDetailChargeKeyFx(depositInput.charges);
						const key = `${selectorKey}:${depositInput.query.distance}:${chargeKey}`;
						const previous = deposits.get(key);
						const targetItemId =
							resolution?.type === InputEnumSchema.enum.Deposit
								? resolution.targetItemId
								: undefined;
						deposits.set(key, {
							kind: "deposit",
							selector: depositInput.query.selector,
							distance: depositInput.query.distance,
							requiredCharges:
								(previous?.requiredCharges ?? 0) +
								(depositInput.charges?.cost ?? 0),
							availableCharges:
								previous?.availableCharges ??
								(yield* readItemDetailDepositAvailableChargesFx({
									input: depositInput,
									ownerItemId,
									runtime,
								})),
							targetItemIds:
								targetItemId === undefined
									? (previous?.targetItemIds ?? [])
									: [
											...(previous?.targetItemIds ?? []),
											targetItemId,
										],
							ready: (previous?.ready ?? true) && (resolution?.ready ?? false),
							...(depositInput.charges === undefined
								? {}
								: {
										charges: depositInput.charges,
									}),
						});
					}),
			)
			.with(
				{
					type: InputEnumSchema.enum.Simple,
				},
				(simpleInput) =>
					Effect.gen(function* () {
						if (simpleInput.charges === undefined) return;
						const key = yield* readItemDetailChargeKeyFx(simpleInput.charges);
						const previous = simple.get(key);
						simple.set(key, {
							kind: "simple",
							count: (previous?.count ?? 0) + 1,
							ready: (previous?.ready ?? true) && (resolution?.ready ?? false),
							charges: simpleInput.charges,
						});
					}),
			)
			.exhaustive();
	}

	return [
		...materials.values(),
		...deposits.values(),
		...simple.values(),
	] satisfies readonly ItemDetailLines.Input[];
});

import { Effect } from "effect";
import { match } from "ts-pattern";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readLineInputDeliveryClaimsFx } from "~/engine/delivery/read/readLineInputDeliveryClaimsFx";
import { readItemDetailChargeKeyFn } from "~/engine/item-detail/fn/readItemDetailChargeKeyFn";
import type { ItemDetailLines } from "~/engine/item-detail/read/ItemDetailLines";
import { readItemDetailDepositAvailableChargesFx } from "~/engine/item-detail/read/readItemDetailDepositAvailableChargesFx";
import { readItemDetailMaterialAutofillAvailabilityFx } from "~/engine/item-detail/read/readItemDetailMaterialAutofillAvailabilityFx";
import type { InputRun } from "~/engine/input/InputRun";
import { TypeSchema } from "~/engine/input/schema/TypeSchema";
import type { InputSchema } from "~/engine/input/schema/InputSchema";
import { LocationScopeEnumSchema } from "~/engine/location/schema/LocationScopeEnumSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readItemDetailInputsFx {
	export interface Props {
		readonly configured: readonly InputSchema.Type[];
		readonly lineId: IdSchema.Type;
		readonly ownerItemId: IdSchema.Type;
		readonly resolved?: readonly InputRun.Resolution[];
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
					type: TypeSchema.enum.Materials,
				},
				(materialInput) =>
					Effect.gen(function* () {
						const required = materialInput.quantity;
						const storedItems = runtime.items.filter(
							(item) =>
								item.location.scope === LocationScopeEnumSchema.enum.Input &&
								item.location.ownerItemId === ownerItemId &&
								item.location.lineId === lineId &&
								item.location.inputIndex === inputIndex,
						);
						const storedQuantity =
							resolution?.type === TypeSchema.enum.Materials
								? resolution.storedQuantity
								: storedItems.reduce((total, item) => total + item.quantity, 0);
						const deliveryQuantity = (yield* readLineInputDeliveryClaimsFx({
							inputIndex,
							lineId,
							ownerItemId,
							runtime,
						})).reduce((total, claim) => total + claim.quantity, 0);
						const maxStoredQuantity =
							resolution?.type === TypeSchema.enum.Materials
								? resolution.maxStoredQuantity
								: required.max + materialInput.capacity;
						const missingQuantity = Math.max(0, required.min - storedQuantity);
						const availableCapacity = Math.max(0, maxStoredQuantity - storedQuantity);
						const autofillAvailability =
							yield* readItemDetailMaterialAutofillAvailabilityFx({
								ownerItemId,
								runtime,
								selector: materialInput.selector,
							});
						const selectorKey = `item:${materialInput.selector.itemId}`;
						const chargeKey = readItemDetailChargeKeyFn(materialInput.charges);
						const key = `${inputIndex}:${selectorKey}:${materialInput.mode}:${chargeKey}`;
						materials.set(key, {
							kind: "materials",
							inputIndex,
							selector: materialInput.selector,
							mode: materialInput.mode,
							required,
							storedQuantity,
							deliveryQuantity,
							autofillAvailableQuantity: autofillAvailability.availableQuantity,
							...(autofillAvailability.producerItemId === undefined
								? {}
								: {
										producerItemId: autofillAvailability.producerItemId,
									}),
							maxStoredQuantity,
							missingQuantity,
							availableCapacity,
							ready: resolution?.ready ?? storedQuantity >= required.min,
							canWithdraw: storedItems.length > 0,
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
					type: TypeSchema.enum.Deposit,
				},
				(depositInput) =>
					Effect.gen(function* () {
						const selectorKey = `item:${depositInput.query.selector.itemId}`;
						const chargeKey = readItemDetailChargeKeyFn(depositInput.charges);
						const key = `${selectorKey}:${depositInput.query.distance}:${chargeKey}`;
						const previous = deposits.get(key);
						const availability =
							previous === undefined
								? yield* readItemDetailDepositAvailableChargesFx({
										input: depositInput,
										ownerItemId,
										runtime,
									})
								: undefined;
						deposits.set(key, {
							kind: "deposit",
							selector: depositInput.query.selector,
							distance: depositInput.query.distance,
							requiredCharges:
								(previous?.requiredCharges ?? 0) +
								(depositInput.charges?.cost ?? 0),
							availableCharges:
								previous?.availableCharges ?? availability?.availableCharges ?? 0,
							targetItemIds:
								previous?.targetItemIds ?? availability?.candidateItemIds ?? [],
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
					type: TypeSchema.enum.Simple,
				},
				(simpleInput) =>
					Effect.gen(function* () {
						if (simpleInput.charges === undefined) return;
						const key = readItemDetailChargeKeyFn(simpleInput.charges);
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

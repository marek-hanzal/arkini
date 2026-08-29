import { Effect } from "effect";
import { match } from "ts-pattern";

import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { readItemRemainingChargesFn } from "~/engine/item/fn/readItemRemainingChargesFn";
import { queryFx } from "~/engine/query/fx/queryFx";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import { readBoardRuntimeItemByIdFx } from "~/game-runtime/read/readBoardRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { ItemDetailLines } from "~/item-line-detail/read/ItemDetailLines";
import { readItemDetailMaterialAutofillAvailabilityFx } from "~/item-line-detail/read/readItemDetailMaterialAutofillAvailabilityFx";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { readLineInputDeliveryClaimsFn } from "~/production-delivery/fn/readLineInputDeliveryClaimsFn";
import type { InputRun } from "~/production-input/InputRun";
import type { DepositSchema } from "~/production-input/schema/DepositSchema";
import type { InputSchema } from "~/production-input/schema/InputSchema";
import { TypeSchema } from "~/production-input/schema/TypeSchema";

const readItemDetailChargeKeyFn = (charges: InputSchema.Type["charges"]) =>
	charges === undefined ? "none" : `${charges.from}:${charges.cost}`;

const readItemDetailDepositAvailableChargesFx = Effect.fn(
	"readItemDetailDepositAvailableChargesFx",
)(function* ({
	input,
	ownerItemId,
	runtime,
}: {
	readonly input: DepositSchema.Type;
	readonly ownerItemId: IdSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	const configuredOwner = runtime.items.find((candidate) => candidate.id === ownerItemId);
	if (
		configuredOwner !== undefined &&
		configuredOwner.location.scope !== LocationScopeEnumSchema.enum.Board
	) {
		return {
			availableCharges: 0,
			candidateItemIds: [],
		};
	}
	const owner = yield* readBoardRuntimeItemByIdFx({
		itemId: ownerItemId,
		runtime,
	});
	const candidates = yield* queryFx({
		origin: owner.location,
		query: input.query,
	}).pipe(
		Effect.provideService(RuntimeFx, {
			read: Effect.succeed(runtime),
		}),
	);

	let availableCharges = 0;
	for (const candidate of candidates) {
		const remainingCharges = readItemRemainingChargesFn(candidate);
		availableCharges += (remainingCharges ?? 0) * candidate.quantity;
	}
	return {
		availableCharges,
		candidateItemIds: candidates.map((candidate) => candidate.id),
	};
});

/** Aggregates one line's authored and resolved inputs into their visible Item Detail groups. */
export const readItemDetailInputsFx = Effect.fn("readItemDetailInputsFx")(function* ({
	configured,
	lineId,
	ownerItemId,
	resolved,
	runtime,
}: {
	readonly configured: readonly InputSchema.Type[];
	readonly lineId: IdSchema.Type;
	readonly ownerItemId: IdSchema.Type;
	readonly resolved?: readonly InputRun.Resolution[];
	readonly runtime: RuntimeSchema.Type;
}) {
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
						const deliveryQuantity = readLineInputDeliveryClaimsFn({
							inputIndex,
							lineId,
							ownerItemId,
							runtime,
						}).reduce((total, claim) => total + claim.quantity, 0);
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

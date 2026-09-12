import { canControlItemProductionFn } from "~/production-line/fn/canControlItemProductionFn";
import { Effect } from "effect";
import { match } from "ts-pattern";

import type { IdSchema } from "~/game-value/schema/IdSchema";
import { readItemRemainingUnitsFn } from "~/production-action/fn/readItemRemainingUnitsFn";
import { queryFx } from "~/item-query/fx/queryFx";
import { RuntimeFx } from "~/game-runtime/context/RuntimeFx";
import { readBoardRuntimeItemByIdFx } from "~/game-runtime/fx/readBoardRuntimeItemByIdFx";
import type { RuntimeSchema } from "~/game-runtime/schema/RuntimeSchema";
import type { ItemDetailLines } from "~/item-line-detail/type/ItemDetailLines";
import { readItemDetailMaterialAutofillAvailabilityFx } from "~/item-line-detail/fx/readItemDetailMaterialAutofillAvailabilityFx";
import { LocationScopeEnumSchema } from "~/item-location/schema/LocationScopeEnumSchema";
import { readLineInputDeliveryClaimsFn } from "~/production-delivery/fn/readLineInputDeliveryClaimsFn";
import type { InputRun } from "~/production-input/type/InputRun";
import type { UnitsSchema } from "~/production-input/schema/UnitsSchema";
import type { InputSchema } from "~/production-input/schema/InputSchema";
import { TypeSchema } from "~/production-input/schema/TypeSchema";

const readItemDetailUnitKeyFn = (units: InputSchema.Type["units"]) =>
	units === undefined ? "none" : `${units.from}:${units.cost}`;

const readItemDetailAvailableUnitsFx = Effect.fn("readItemDetailAvailableUnitsFx")(function* ({
	input,
	ownerItemId,
	runtime,
}: {
	readonly input: UnitsSchema.Type;
	readonly ownerItemId: IdSchema.Type;
	readonly runtime: RuntimeSchema.Type;
}) {
	const configuredOwner = runtime.items.find((candidate) => candidate.id === ownerItemId);
	if (
		configuredOwner !== undefined &&
		configuredOwner.location.scope !== LocationScopeEnumSchema.enum.Board
	) {
		return {
			availableUnits: 0,
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

	let availableUnits = 0;
	for (const candidate of candidates) {
		const remainingUnits = readItemRemainingUnitsFn(candidate);
		availableUnits += (remainingUnits ?? 0) * candidate.quantity;
	}
	return {
		availableUnits,
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
	const owner = runtime.items.find((item) => item.id === ownerItemId);
	const canControl = owner !== undefined && canControlItemProductionFn(owner.item);
	const materials = new Map<string, ItemDetailLines.MaterialInput>();
	const unitInputs = new Map<string, ItemDetailLines.UnitsInput>();
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
						const unitKey = readItemDetailUnitKeyFn(materialInput.units);
						const key = `${inputIndex}:${selectorKey}:${materialInput.mode}:${unitKey}`;
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
							canWithdraw: canControl && storedItems.length > 0,
							...(materialInput.units === undefined
								? {}
								: {
										units: materialInput.units,
									}),
						});
					}),
			)
			.with(
				{
					type: TypeSchema.enum.Units,
				},
				(unitsInput) =>
					Effect.gen(function* () {
						const selectorKey = `item:${unitsInput.query.selector.itemId}`;
						const unitKey = readItemDetailUnitKeyFn(unitsInput.units);
						const key = `${selectorKey}:${unitsInput.query.distance}:${unitKey}`;
						const previous = unitInputs.get(key);
						const availability =
							previous === undefined
								? yield* readItemDetailAvailableUnitsFx({
										input: unitsInput,
										ownerItemId,
										runtime,
									})
								: undefined;
						unitInputs.set(key, {
							kind: "units",
							selector: unitsInput.query.selector,
							distance: unitsInput.query.distance,
							requiredUnits:
								(previous?.requiredUnits ?? 0) + (unitsInput.units?.cost ?? 0),
							availableUnits:
								previous?.availableUnits ?? availability?.availableUnits ?? 0,
							targetItemIds:
								previous?.targetItemIds ?? availability?.candidateItemIds ?? [],
							ready: (previous?.ready ?? true) && (resolution?.ready ?? false),
							...(unitsInput.units === undefined
								? {}
								: {
										units: unitsInput.units,
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
						if (simpleInput.units === undefined) return;
						const key = readItemDetailUnitKeyFn(simpleInput.units);
						const previous = simple.get(key);
						simple.set(key, {
							kind: "simple",
							count: (previous?.count ?? 0) + 1,
							ready: (previous?.ready ?? true) && (resolution?.ready ?? false),
							units: simpleInput.units,
						});
					}),
			)
			.exhaustive();
	}

	return [
		...materials.values(),
		...unitInputs.values(),
		...simple.values(),
	] satisfies readonly ItemDetailLines.Input[];
});

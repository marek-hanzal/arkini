import { Effect } from "effect";

import type {
	PlannerAcquisitionGraph,
	PlannerAcquisitionQuantityDistribution,
	PlannerAcquisitionQuantityProbability,
	PlannerAcquisitionRequirement,
} from "~/editor/planner/PlannerAcquisitionGraph";
import type {
	PlannerExpectedEconomics,
	PlannerExpectedEconomicsAcquiredItem,
	PlannerExpectedEconomicsAssumption,
	PlannerExpectedEconomicsChargeQuantity,
	PlannerExpectedEconomicsItemQuantity,
	PlannerExpectedEconomicsOperation,
} from "~/editor/planner/PlannerExpectedEconomics";
import type { PlannerSearchTraceEntry } from "~/editor/planner/PlannerSearch";
import { readPlannerExpectedIndependentRuns } from "~/editor/planner/readPlannerExpectedIndependentRuns";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import { GameEventEnumSchema } from "~/engine/event/schema/GameEventEnumSchema";
import type { RuntimeSchema } from "~/engine/runtime/schema/RuntimeSchema";

export namespace readPlannerExpectedEconomicsFx {
	export interface Props {
		readonly graph: PlannerAcquisitionGraph;
		readonly initialRuntime: RuntimeSchema.Type;
		readonly itemId: IdSchema.Type;
		readonly quantity: number;
		readonly trace: ReadonlyArray<PlannerSearchTraceEntry>;
	}
}

interface PlannerItemLot {
	consumedQuantity: number;
	quantity: number;
	readonly sourceStepIndex?: number;
}

interface PlannerItemFlowDependency {
	readonly itemId: IdSchema.Type;
	readonly quantity: number;
	readonly sourceStepIndex: number;
	readonly targetStepIndex: number;
}

interface PlannerRetainedRequirementDemand {
	retained: number;
	reserved: number;
}

interface MutablePlannerExpectedOperation {
	readonly action: PlannerExpectedEconomicsOperation["action"];
	readonly actionId: string;
	expectedElapsedMs: number;
	expectedRuns: number;
	readonly firstStepIndex: number;
	observedElapsedMs: number;
	observedRuns: number;
}

const quantityEpsilon = 1e-9;
const compareIds = (left: string, right: string) => left.localeCompare(right);

const addQuantity = (
	quantities: Map<IdSchema.Type, number>,
	itemId: IdSchema.Type,
	quantity: number,
) => {
	if (quantity <= quantityEpsilon) return;
	quantities.set(itemId, (quantities.get(itemId) ?? 0) + quantity);
};

const readConstantDistribution = (quantity: number): PlannerAcquisitionQuantityDistribution => [
	{
		probability: 1,
		quantity,
	},
];

const readInitialLots = (runtime: RuntimeSchema.Type) => {
	const quantities = new Map<IdSchema.Type, number>();
	for (const item of runtime.items) addQuantity(quantities, item.item.id, item.quantity);
	return new Map<IdSchema.Type, PlannerItemLot[]>(
		[
			...quantities,
		].map(([itemId, quantity]) => [
			itemId,
			[
				{
					consumedQuantity: 0,
					quantity,
				},
			],
		]),
	);
};

const takeItemLots = ({
	itemId,
	lotsByItemId,
	onTake,
	quantity,
}: {
	readonly itemId: IdSchema.Type;
	readonly lotsByItemId: Map<IdSchema.Type, PlannerItemLot[]>;
	readonly onTake: (lot: PlannerItemLot, quantity: number) => void;
	readonly quantity: number;
}) => {
	const lots = lotsByItemId.get(itemId) ?? [];
	let remaining = quantity;
	for (let index = lots.length - 1; index >= 0 && remaining > quantityEpsilon; index -= 1) {
		const lot = lots[index];
		if (lot === undefined || lot.quantity <= quantityEpsilon) continue;
		const taken = Math.min(lot.quantity, remaining);
		lot.consumedQuantity += taken;
		lot.quantity -= taken;
		remaining -= taken;
		onTake(lot, taken);
		if (lot.quantity <= quantityEpsilon) lots.splice(index, 1);
	}
	lotsByItemId.set(itemId, lots);
	if (remaining > quantityEpsilon)
		throw new RangeError(
			`Planner trace item flow over-consumed ${itemId} by ${remaining.toString()} units.`,
		);
};

const readRequirementKey = (requirement: PlannerAcquisitionRequirement) =>
	JSON.stringify([
		requirement.itemId,
		requirement.minimumQuantity,
		requirement.source,
		requirement.usage,
		requirement.inputIndex ?? null,
		requirement.ruleIndex ?? null,
		requirement.whenIndex ?? null,
	]);

const readRelevantRoutes = ({
	graph,
	step,
}: {
	readonly graph: PlannerAcquisitionGraph;
	readonly step: PlannerSearchTraceEntry;
}) => {
	const routeById = new Map(
		graph.routes.map((route) => [
			route.id,
			route,
		]),
	);
	const producedItemIds = new Set(step.producedItemQuantities.map(({ itemId }) => itemId));
	return step.routeIds.flatMap((routeId) => {
		const route = routeById.get(routeId);
		if (route === undefined) return [];
		return [
			{
				includeOutputConditions:
					producedItemIds.has(route.output.itemId) ||
					(step.outputResolution.type === "existential" &&
						step.outputResolution.routeId === route.id),
				route,
			},
		];
	});
};

const readRetainedRequirements = ({
	graph,
	step,
}: {
	readonly graph: PlannerAcquisitionGraph;
	readonly step: PlannerSearchTraceEntry;
}) => {
	const allOfByKey = new Map<string, PlannerAcquisitionRequirement>();
	const anyOfByKey = new Map<string, ReadonlyArray<PlannerAcquisitionRequirement>>();
	for (const { includeOutputConditions, route } of readRelevantRoutes({
		graph,
		step,
	})) {
		const includeRequirement = (requirement: PlannerAcquisitionRequirement) =>
			requirement.usage !== "consume" &&
			(includeOutputConditions || requirement.source !== "output-condition");
		for (const requirement of route.requirements.allOf)
			if (includeRequirement(requirement))
				allOfByKey.set(readRequirementKey(requirement), requirement);
		for (const clause of route.requirements.anyOf) {
			const retained = clause.filter(includeRequirement);
			if (retained.length === 0) continue;
			const key = retained.map(readRequirementKey).sort(compareIds).join("\u0000");
			anyOfByKey.set(key, retained);
		}
	}
	return {
		allOf: [
			...allOfByKey.values(),
		],
		anyOf: [
			...anyOfByKey.values(),
		],
	};
};

const readAvailableLotQuantity = (lots: ReadonlyArray<PlannerItemLot>) =>
	lots.reduce((total, lot) => total + lot.quantity, 0);

const addRetainedDemand = (
	demandByItemId: Map<IdSchema.Type, PlannerRetainedRequirementDemand>,
	requirement: PlannerAcquisitionRequirement,
) => {
	const demand = demandByItemId.get(requirement.itemId) ?? {
		retained: 0,
		reserved: 0,
	};
	if (requirement.usage === "reserve") demand.reserved += requirement.minimumQuantity;
	else demand.retained = Math.max(demand.retained, requirement.minimumQuantity);
	demandByItemId.set(requirement.itemId, demand);
};

const peekRetainedItemLots = ({
	itemId,
	lotsByItemId,
	minimumOutputByStep,
	quantity,
}: {
	readonly itemId: IdSchema.Type;
	readonly lotsByItemId: ReadonlyMap<IdSchema.Type, ReadonlyArray<PlannerItemLot>>;
	readonly minimumOutputByStep: ReadonlyArray<Map<IdSchema.Type, number>>;
	readonly quantity: number;
}) => {
	const lots = lotsByItemId.get(itemId) ?? [];
	let remaining = quantity;
	for (const lot of lots) {
		if (remaining <= quantityEpsilon) break;
		if (lot.quantity <= quantityEpsilon) continue;
		const retained = Math.min(lot.quantity, remaining);
		remaining -= retained;
		if (lot.sourceStepIndex === undefined) continue;
		const quantities = minimumOutputByStep[lot.sourceStepIndex];
		if (quantities === undefined) continue;
		const minimumSourceQuantity = lot.consumedQuantity + retained;
		quantities.set(itemId, Math.max(quantities.get(itemId) ?? 0, minimumSourceQuantity));
	}
	if (remaining > quantityEpsilon)
		throw new RangeError(
			`Planner trace retained requirement over-requested ${itemId} by ${remaining.toString()} units.`,
		);
};

const readFlowDependencies = ({
	graph,
	initialRuntime,
	itemId,
	quantity,
	trace,
}: readPlannerExpectedEconomicsFx.Props) => {
	const lotsByItemId = readInitialLots(initialRuntime);
	const dependenciesByTargetStep = Array.from(
		{
			length: trace.length,
		},
		() => [] as PlannerItemFlowDependency[],
	);
	const retainedMinimumOutputByStep = Array.from(
		{
			length: trace.length,
		},
		() => new Map<IdSchema.Type, number>(),
	);

	for (const [stepIndex, step] of trace.entries()) {
		const retainedRequirements = readRetainedRequirements({
			graph,
			step,
		});
		const retainedDemandByItemId = new Map<IdSchema.Type, PlannerRetainedRequirementDemand>();
		for (const requirement of retainedRequirements.allOf)
			addRetainedDemand(retainedDemandByItemId, requirement);
		for (const clause of retainedRequirements.anyOf) {
			const selected = clause.find(
				(requirement) =>
					readAvailableLotQuantity(lotsByItemId.get(requirement.itemId) ?? []) >=
					requirement.minimumQuantity,
			);
			if (selected !== undefined) addRetainedDemand(retainedDemandByItemId, selected);
		}
		for (const [retainedItemId, demand] of retainedDemandByItemId)
			peekRetainedItemLots({
				itemId: retainedItemId,
				lotsByItemId,
				minimumOutputByStep: retainedMinimumOutputByStep,
				quantity: demand.retained + demand.reserved,
			});
		for (const consumed of step.consumedItemQuantities)
			takeItemLots({
				itemId: consumed.itemId,
				lotsByItemId,
				onTake: (lot, taken) => {
					if (lot.sourceStepIndex === undefined) return;
					dependenciesByTargetStep[stepIndex]?.push({
						itemId: consumed.itemId,
						quantity: taken,
						sourceStepIndex: lot.sourceStepIndex,
						targetStepIndex: stepIndex,
					});
				},
				quantity: consumed.quantity,
			});

		for (const produced of step.producedItemQuantities) {
			const lots = lotsByItemId.get(produced.itemId) ?? [];
			lots.push({
				consumedQuantity: 0,
				quantity: produced.quantity,
				sourceStepIndex: stepIndex,
			});
			lotsByItemId.set(produced.itemId, lots);
		}
	}

	const terminalQuantityByStep = Array.from(
		{
			length: trace.length,
		},
		() => new Map<IdSchema.Type, number>(),
	);
	takeItemLots({
		itemId,
		lotsByItemId,
		onTake: (lot, taken) => {
			if (lot.sourceStepIndex === undefined) return;
			const quantities = terminalQuantityByStep[lot.sourceStepIndex];
			if (quantities !== undefined) addQuantity(quantities, itemId, taken);
		},
		quantity,
	});

	return {
		dependenciesByTargetStep,
		retainedMinimumOutputByStep,
		terminalQuantityByStep,
	};
};

const readChargePredecessorsByStep = (trace: ReadonlyArray<PlannerSearchTraceEntry>) => {
	const chargeStepsByRuntimeItemId = new Map<IdSchema.Type, number[]>();
	const predecessorsByStep = new Map<number, ReadonlyArray<number>>();

	for (const [stepIndex, step] of trace.entries())
		for (const event of step.events) {
			if (event.type === GameEventEnumSchema.enum.ItemChargeSpent) {
				const steps = chargeStepsByRuntimeItemId.get(event.itemId) ?? [];
				if (steps.at(-1) !== stepIndex) steps.push(stepIndex);
				chargeStepsByRuntimeItemId.set(event.itemId, steps);
				continue;
			}
			if (event.type !== GameEventEnumSchema.enum.ItemDepleted) continue;
			const existing = predecessorsByStep.get(stepIndex) ?? [];
			predecessorsByStep.set(
				stepIndex,
				[
					...new Set([
						...existing,
						...(chargeStepsByRuntimeItemId.get(event.itemId) ?? []).filter(
							(candidate) => candidate < stepIndex,
						),
					]),
				].sort((left, right) => left - right),
			);
			chargeStepsByRuntimeItemId.delete(event.itemId);
		}

	return predecessorsByStep;
};

const readOutputDistribution = ({
	itemId,
	producedQuantity,
	step,
}: {
	readonly itemId: IdSchema.Type;
	readonly producedQuantity: number;
	readonly step: PlannerSearchTraceEntry;
}): ReadonlyArray<PlannerAcquisitionQuantityProbability> => {
	const resolution = step.outputResolution;
	if (resolution.type !== "existential" || resolution.outputItemId !== itemId)
		return readConstantDistribution(producedQuantity);
	const guaranteedBaseline = Math.max(
		0,
		producedQuantity - resolution.statistics.maximumQuantity,
	);
	return resolution.statistics.quantityDistribution.map((entry) => ({
		...entry,
		quantity: entry.quantity + guaranteedBaseline,
	}));
};

const readExpectedMultipliers = ({
	itemId,
	quantity,
	trace,
	...props
}: readPlannerExpectedEconomicsFx.Props) => {
	const { dependenciesByTargetStep, retainedMinimumOutputByStep, terminalQuantityByStep } =
		readFlowDependencies({
			itemId,
			quantity,
			trace,
			...props,
		});
	const chargePredecessorsByStep = readChargePredecessorsByStep(trace);
	const requiredOutputByStep = terminalQuantityByStep;
	const forcedMultiplierByStep = Array.from(
		{
			length: trace.length,
		},
		() => 0,
	);
	const multiplierByStep = Array.from(
		{
			length: trace.length,
		},
		() => 0,
	);

	for (let stepIndex = trace.length - 1; stepIndex >= 0; stepIndex -= 1) {
		const step = trace[stepIndex];
		if (step === undefined) continue;
		let multiplier = forcedMultiplierByStep[stepIndex] ?? 0;
		const producedQuantityByItemId = new Map(
			step.producedItemQuantities.map((entry) => [
				entry.itemId,
				entry.quantity,
			]),
		);
		const requiredItemIds = new Set([
			...(requiredOutputByStep[stepIndex]?.keys() ?? []),
			...(retainedMinimumOutputByStep[stepIndex]?.keys() ?? []),
		]);
		for (const requiredItemId of requiredItemIds) {
			const requiredQuantity = Math.max(
				requiredOutputByStep[stepIndex]?.get(requiredItemId) ?? 0,
				retainedMinimumOutputByStep[stepIndex]?.get(requiredItemId) ?? 0,
			);
			const producedQuantity = producedQuantityByItemId.get(requiredItemId) ?? 0;
			if (producedQuantity <= quantityEpsilon)
				throw new RangeError(
					`Planner trace step ${step.actionId} did not produce required ${requiredItemId}.`,
				);
			multiplier = Math.max(
				multiplier,
				readPlannerExpectedIndependentRuns({
					distribution: readOutputDistribution({
						itemId: requiredItemId,
						producedQuantity,
						step,
					}),
					quantity: requiredQuantity,
				}),
			);
		}
		multiplierByStep[stepIndex] = multiplier;
		if (multiplier <= quantityEpsilon) continue;

		for (const predecessorStepIndex of chargePredecessorsByStep.get(stepIndex) ?? [])
			forcedMultiplierByStep[predecessorStepIndex] = Math.max(
				forcedMultiplierByStep[predecessorStepIndex] ?? 0,
				multiplier,
			);

		for (const dependency of dependenciesByTargetStep[stepIndex] ?? []) {
			const quantities = requiredOutputByStep[dependency.sourceStepIndex];
			if (quantities === undefined) continue;
			addQuantity(quantities, dependency.itemId, dependency.quantity * multiplier);
		}
	}

	return multiplierByStep;
};

const readExpectedItemQuantities = (
	quantities: ReadonlyMap<IdSchema.Type, number>,
): PlannerExpectedEconomicsItemQuantity[] =>
	[
		...quantities,
	]
		.filter(([, quantity]) => quantity > quantityEpsilon)
		.map(([itemId, quantity]) => ({
			itemId,
			quantity,
		}))
		.sort((left, right) => compareIds(left.itemId, right.itemId));

const readExpectedAcquiredItems = (
	quantities: ReadonlyMap<
		IdSchema.Type,
		{
			readonly quantity: number;
			readonly readyAtMs: number;
		}
	>,
): PlannerExpectedEconomicsAcquiredItem[] =>
	[
		...quantities,
	]
		.filter(([, acquired]) => acquired.quantity > quantityEpsilon)
		.map(([itemId, acquired]) => ({
			itemId,
			quantity: acquired.quantity,
			readyAtMs: acquired.readyAtMs,
		}))
		.sort((left, right) => compareIds(left.itemId, right.itemId));

const readExpectedChargeQuantities = (
	quantities: ReadonlyMap<IdSchema.Type, number>,
): PlannerExpectedEconomicsChargeQuantity[] =>
	[
		...quantities,
	]
		.filter(([, charges]) => charges > quantityEpsilon)
		.map(([itemId, charges]) => ({
			charges,
			itemId,
		}))
		.sort((left, right) => compareIds(left.itemId, right.itemId));

const readRequiredInitialActors = ({
	initialRuntime,
	trace,
}: Pick<
	readPlannerExpectedEconomicsFx.Props,
	"initialRuntime" | "trace"
>): PlannerExpectedEconomics["requiredInitialActors"] => {
	const initialItemIdByRuntimeItemId = new Map(
		initialRuntime.items.map((runtimeItem) => [
			runtimeItem.id,
			runtimeItem.item.id,
		]),
	);
	const runtimeItemIdsByItemId = new Map<IdSchema.Type, Set<IdSchema.Type>>();

	for (const step of trace) {
		if (step.action.kind !== "line" || step.actor.kind !== "line") continue;
		if (
			initialItemIdByRuntimeItemId.get(step.actor.ownerRuntimeItemId) !==
			step.action.ownerItemId
		)
			continue;
		const runtimeItemIds =
			runtimeItemIdsByItemId.get(step.action.ownerItemId) ?? new Set<IdSchema.Type>();
		runtimeItemIds.add(step.actor.ownerRuntimeItemId);
		runtimeItemIdsByItemId.set(step.action.ownerItemId, runtimeItemIds);
	}

	return [
		...runtimeItemIdsByItemId,
	]
		.map(([itemId, runtimeItemIds]) => ({
			itemId,
			quantity: runtimeItemIds.size,
		}))
		.sort((left, right) => compareIds(left.itemId, right.itemId));
};

/** Estimates independent replay economics for one concrete engine-valid planner trace. */
export const readPlannerExpectedEconomicsFx = Effect.fn("readPlannerExpectedEconomicsFx")(
	(props: readPlannerExpectedEconomicsFx.Props) =>
		Effect.sync(() => {
			const multiplierByStep = readExpectedMultipliers(props);
			const expectedAcquiredByItemId = new Map<
				IdSchema.Type,
				{
					quantity: number;
					readyAtMs: number;
				}
			>();
			const expectedConsumedByItemId = new Map<IdSchema.Type, number>();
			const expectedSpentChargesByItemId = new Map<IdSchema.Type, number>();
			const operationByActionId = new Map<string, MutablePlannerExpectedOperation>();
			let expectedActionRuns = 0;
			let expectedElapsedMs = 0;
			let observedElapsedMs = 0;

			for (const [stepIndex, step] of props.trace.entries()) {
				const multiplier = multiplierByStep[stepIndex] ?? 0;
				expectedActionRuns += multiplier;
				expectedElapsedMs += multiplier * step.elapsedMs;
				observedElapsedMs += step.elapsedMs;
				for (const produced of step.producedItemQuantities) {
					const quantity = produced.quantity * multiplier;
					if (quantity <= quantityEpsilon) continue;
					const current = expectedAcquiredByItemId.get(produced.itemId);
					expectedAcquiredByItemId.set(produced.itemId, {
						quantity: (current?.quantity ?? 0) + quantity,
						readyAtMs: Math.max(current?.readyAtMs ?? 0, expectedElapsedMs),
					});
				}
				for (const consumed of step.consumedItemQuantities)
					addQuantity(
						expectedConsumedByItemId,
						consumed.itemId,
						consumed.quantity * multiplier,
					);
				for (const spent of step.spentChargeQuantities)
					addQuantity(
						expectedSpentChargesByItemId,
						spent.itemId,
						spent.charges * multiplier,
					);

				const operation = operationByActionId.get(step.actionId) ?? {
					action: step.action,
					actionId: step.actionId,
					expectedElapsedMs: 0,
					expectedRuns: 0,
					firstStepIndex: stepIndex,
					observedElapsedMs: 0,
					observedRuns: 0,
				};
				operation.expectedElapsedMs += multiplier * step.elapsedMs;
				operation.expectedRuns += multiplier;
				operation.observedElapsedMs += step.elapsedMs;
				operation.observedRuns += 1;
				operationByActionId.set(step.actionId, operation);
			}

			const expectedAcquiredItems = readExpectedAcquiredItems(expectedAcquiredByItemId);
			const expectedConsumedItems = readExpectedItemQuantities(expectedConsumedByItemId);
			const expectedSpentCharges = readExpectedChargeQuantities(expectedSpentChargesByItemId);
			const requiredInitialActors = readRequiredInitialActors(props);
			const initialTargetQuantity = props.initialRuntime.items.reduce(
				(total, item) => total + (item.item.id === props.itemId ? item.quantity : 0),
				0,
			);
			const assumptions: PlannerExpectedEconomicsAssumption[] = [
				"optimistic-engine-policies",
			];
			if (props.trace.length > 0)
				assumptions.push(
					"same-step-canonical-flows-are-netted",
					"selected-trace-actions-remain-repeatable",
				);
			if (props.trace.length > 1) assumptions.push("operations-run-sequentially");
			if (
				multiplierByStep.some(
					(multiplier) => Math.abs(multiplier - Math.round(multiplier)) > quantityEpsilon,
				)
			)
				assumptions.push("fractional-demands-use-linear-interpolation");
			if (props.trace.some((step) => step.outputResolution.type === "existential"))
				assumptions.push("independent-output-resolutions");
			const operations: PlannerExpectedEconomicsOperation[] = [
				...operationByActionId.values(),
			]
				.sort((left, right) => left.firstStepIndex - right.firstStepIndex)
				.map(({ firstStepIndex: _firstStepIndex, ...operation }) => operation);

			return {
				assumptions,
				expectedActionRuns,
				expectedAcquiredItems,
				expectedConsumedItems,
				expectedElapsedMs,
				requiredInitialActors,
				expectedSpentCharges,
				initialTargetQuantity,
				method: "selected-trace-replay",
				observedActionRuns: props.trace.length,
				observedElapsedMs,
				operations,
				requiredAdditionalTargetQuantity: Math.max(
					0,
					props.quantity - initialTargetQuantity,
				),
				targetItemId: props.itemId,
				targetQuantity: props.quantity,
				totalExpectedAcquiredQuantity: expectedAcquiredItems.reduce(
					(total, item) => total + item.quantity,
					0,
				),
				totalExpectedConsumedQuantity: expectedConsumedItems.reduce(
					(total, item) => total + item.quantity,
					0,
				),
				totalExpectedSpentCharges: expectedSpentCharges.reduce(
					(total, item) => total + item.charges,
					0,
				),
			} satisfies PlannerExpectedEconomics;
		}),
);

import type {
	PlannerAcquisitionOutput,
	PlannerAcquisitionQuantityDistribution,
	PlannerAcquisitionRequirement,
	PlannerAcquisitionRequirements,
	PlannerAcquisitionRoute,
	PlannerAcquisitionSelection,
} from "~/editor/planner/PlannerAcquisitionGraph";
import type { PlannerLineAction } from "~/editor/planner/PlannerAction";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { DropSchema } from "~/engine/output/schema/DropSchema";
import type { OutputSelectionWitness } from "~/engine/output/OutputSelectionWitness";
import type { OutputSchema } from "~/engine/output/schema/OutputSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";
import type { WhenSchema } from "~/engine/when/schema/WhenSchema";

interface AvailabilityRule {
	readonly type: string;
	readonly when: ReadonlyArray<WhenSchema.Type>;
}

interface OutputWitness {
	readonly output: PlannerAcquisitionOutput;
	readonly requirements: PlannerAcquisitionRequirements;
}

interface LineDescriptor {
	readonly action: PlannerLineAction;
	readonly chargeCostsByItemId: ReadonlyMap<IdSchema.Type, ReadonlyArray<number>>;
	readonly line: LineSchema.Type;
	readonly requirements: PlannerAcquisitionRequirements;
}

const compareIds = (left: string, right: string) => left.localeCompare(right);

const makeStableId = (...parts: ReadonlyArray<number | string>) =>
	parts.map((part) => encodeURIComponent(String(part))).join(":");

const compareRequirements = (
	left: PlannerAcquisitionRequirement,
	right: PlannerAcquisitionRequirement,
) =>
	compareIds(left.itemId, right.itemId) ||
	compareIds(left.source, right.source) ||
	compareIds(left.usage, right.usage) ||
	(left.inputIndex ?? -1) - (right.inputIndex ?? -1) ||
	(left.ruleIndex ?? -1) - (right.ruleIndex ?? -1) ||
	(left.whenIndex ?? -1) - (right.whenIndex ?? -1) ||
	left.minimumQuantity - right.minimumQuantity ||
	(left.chargeCost ?? 0) - (right.chargeCost ?? 0);

const normalizeRequirements = ({
	allOf,
	anyOf,
}: PlannerAcquisitionRequirements): PlannerAcquisitionRequirements => ({
	allOf: [
		...allOf,
	].sort(compareRequirements),
	anyOf: anyOf
		.map((clause) =>
			[
				...clause,
			].sort(compareRequirements),
		)
		.sort((left, right) => {
			const leftKey = left
				.map((requirement) =>
					[
						requirement.itemId,
						requirement.minimumQuantity,
						requirement.source,
						requirement.usage,
					].join("\u0000"),
				)
				.join("\u0001");
			const rightKey = right
				.map((requirement) =>
					[
						requirement.itemId,
						requirement.minimumQuantity,
						requirement.source,
						requirement.usage,
					].join("\u0000"),
				)
				.join("\u0001");
			return compareIds(leftKey, rightKey);
		}),
});

const combineRequirements = (
	...requirements: ReadonlyArray<PlannerAcquisitionRequirements>
): PlannerAcquisitionRequirements =>
	normalizeRequirements({
		allOf: requirements.flatMap(({ allOf }) => allOf),
		anyOf: requirements.flatMap(({ anyOf }) => anyOf),
	});

const probabilityEpsilon = 1e-12;

const normalizeQuantityDistribution = (
	quantityProbability: ReadonlyMap<number, number>,
): PlannerAcquisitionQuantityDistribution => {
	const entries = [
		...quantityProbability,
	]
		.filter(([, probability]) => probability > probabilityEpsilon)
		.sort(([left], [right]) => left - right);
	const total = entries.reduce((sum, [, probability]) => sum + probability, 0);
	if (!(total > 0))
		throw new RangeError("Planner quantity distribution has no probability mass.");
	return entries.map(([quantity, probability]) => ({
		probability: probability / total,
		quantity,
	}));
};

const makeConstantQuantityDistribution = (
	quantity: number,
): PlannerAcquisitionQuantityDistribution => [
	{
		probability: 1,
		quantity,
	},
];

const makeUniformQuantityDistribution = ({
	max,
	min,
}: DropSchema.Type["quantity"]): PlannerAcquisitionQuantityDistribution => {
	const probability = 1 / (max - min + 1);
	return Array.from(
		{
			length: max - min + 1,
		},
		(_, index) => ({
			probability,
			quantity: min + index,
		}),
	);
};

const mixQuantityDistributions = (
	branches: ReadonlyArray<{
		readonly distribution: PlannerAcquisitionQuantityDistribution;
		readonly probability: number;
	}>,
): PlannerAcquisitionQuantityDistribution => {
	const result = new Map<number, number>();
	for (const branch of branches) {
		if (branch.probability <= 0) continue;
		for (const entry of branch.distribution)
			result.set(
				entry.quantity,
				(result.get(entry.quantity) ?? 0) + branch.probability * entry.probability,
			);
	}
	return normalizeQuantityDistribution(result);
};

const convolveQuantityDistributions = (
	left: PlannerAcquisitionQuantityDistribution,
	right: PlannerAcquisitionQuantityDistribution,
): PlannerAcquisitionQuantityDistribution => {
	const result = new Map<number, number>();
	for (const leftEntry of left)
		for (const rightEntry of right) {
			const quantity = leftEntry.quantity + rightEntry.quantity;
			result.set(
				quantity,
				(result.get(quantity) ?? 0) + leftEntry.probability * rightEntry.probability,
			);
		}
	return normalizeQuantityDistribution(result);
};

const repeatQuantityDistribution = (
	distribution: PlannerAcquisitionQuantityDistribution,
	count: number,
): PlannerAcquisitionQuantityDistribution => {
	let result = makeConstantQuantityDistribution(0);
	for (let index = 0; index < count; index += 1)
		result = convolveQuantityDistributions(result, distribution);
	return result;
};

const withZeroQuantityProbability = ({
	distribution,
	probability,
}: {
	readonly distribution: PlannerAcquisitionQuantityDistribution;
	readonly probability: number;
}) =>
	mixQuantityDistributions([
		{
			distribution,
			probability,
		},
		{
			distribution: makeConstantQuantityDistribution(0),
			probability: 1 - probability,
		},
	]);

const readExpectedQuantity = (distribution: PlannerAcquisitionQuantityDistribution) =>
	distribution.reduce((total, entry) => total + entry.quantity * entry.probability, 0);

const readOccurrenceProbability = (distribution: PlannerAcquisitionQuantityDistribution) =>
	1 - (distribution.find(({ quantity }) => quantity === 0)?.probability ?? 0);

const readMaximumQuantity = (distribution: PlannerAcquisitionQuantityDistribution) =>
	distribution.at(-1)?.quantity ?? 0;

const readMaximumQuantityProbability = (distribution: PlannerAcquisitionQuantityDistribution) =>
	distribution.at(-1)?.probability ?? 0;

const readItemLines = (item: ItemSchema.Type): ReadonlyArray<LineSchema.Type> => {
	switch (item.type) {
		case "blueprint":
		case "craft":
		case "stash":
			return [
				item.line,
			];
		case "deposit":
		case "producer":
			return item.lines ?? [];
		case "inventory":
		case "simple":
		case "temporary":
			return [];
	}
};

const readSatisfyMinimumQuantity = (when: WhenSchema.Type) => {
	switch (when.type) {
		case "exists":
			return 1;
		case "count":
			return when.count;
		case "range":
			return when.min;
	}
};

/**
 * Returns the smallest positive fact that may falsify one condition.
 *
 * `undefined` means it may be falsified without acquiring another item, for example by keeping an
 * `exists` match outside the optimistic relation or by using quantity zero.
 */
const readFalsifyMinimumQuantity = (when: WhenSchema.Type) => {
	switch (when.type) {
		case "exists":
			return undefined;
		case "count":
			return when.count === 0 ? 1 : undefined;
		case "range":
			return when.min === 0 ? when.max + 1 : undefined;
	}
};

const makeConditionRequirement = ({
	minimumQuantity,
	ruleIndex,
	source,
	when,
	whenIndex,
}: {
	readonly minimumQuantity: number;
	readonly ruleIndex: number;
	readonly source: "line-condition" | "output-condition";
	readonly when: WhenSchema.Type;
	readonly whenIndex: number;
}): PlannerAcquisitionRequirement => ({
	itemId: when.query.selector.itemId,
	minimumQuantity,
	ruleIndex,
	source,
	usage: "presence",
	whenIndex,
});

/**
 * Enable rules contribute AND facts. Each disable rule contributes one OR clause because
 * falsifying any one of its conditions suppresses the veto. Absence and upper bounds are relaxed
 * deliberately so structural failure remains a sound proof boundary.
 */
const readAvailabilityRequirements = (
	rules: ReadonlyArray<AvailabilityRule>,
	source: "line-condition" | "output-condition",
): PlannerAcquisitionRequirements => {
	const allOf: PlannerAcquisitionRequirement[] = [];
	const anyOf: PlannerAcquisitionRequirement[][] = [];

	for (const [ruleIndex, rule] of rules.entries()) {
		if (rule.type === "enable") {
			for (const [whenIndex, when] of rule.when.entries()) {
				const minimumQuantity = readSatisfyMinimumQuantity(when);
				if (minimumQuantity <= 0) continue;
				allOf.push(
					makeConditionRequirement({
						minimumQuantity,
						ruleIndex,
						source,
						when,
						whenIndex,
					}),
				);
			}
			continue;
		}
		if (rule.type !== "disable") continue;

		const alternatives: PlannerAcquisitionRequirement[] = [];
		let hasFactFreeAlternative = false;
		for (const [whenIndex, when] of rule.when.entries()) {
			const minimumQuantity = readFalsifyMinimumQuantity(when);
			if (minimumQuantity === undefined) {
				hasFactFreeAlternative = true;
				break;
			}
			alternatives.push(
				makeConditionRequirement({
					minimumQuantity,
					ruleIndex,
					source,
					when,
					whenIndex,
				}),
			);
		}
		if (!hasFactFreeAlternative && alternatives.length > 0) anyOf.push(alternatives);
	}

	return normalizeRequirements({
		allOf,
		anyOf,
	});
};

const readDropWitness = ({
	distribution,
	drop,
	selection,
	witness,
	witnessId,
}: {
	readonly distribution: PlannerAcquisitionQuantityDistribution;
	readonly drop: DropSchema.Type;
	readonly selection: PlannerAcquisitionSelection;
	readonly witness: Omit<OutputSelectionWitness, "itemId">;
	readonly witnessId: string;
}): OutputWitness => {
	const maximumQuantity = readMaximumQuantity(distribution);
	return {
		output: {
			expectedQuantity: readExpectedQuantity(distribution),
			itemId: drop.itemId,
			maximumQuantity,
			maximumQuantityProbability: readMaximumQuantityProbability(distribution),
			occurrenceProbability: readOccurrenceProbability(distribution),
			quantityDistribution: distribution,
			selection,
			stochastic: distribution.length > 1,
			witness: {
				...witness,
				itemId: drop.itemId,
			},
			witnessId,
		},
		requirements: readAvailabilityRequirements(drop.rules, "output-condition"),
	};
};

const readWeightedOccurrenceDistribution = ({
	candidateProbability,
	drop,
	maximumSelections,
	minimumSelections,
	setProbability,
}: {
	readonly candidateProbability: number;
	readonly drop: DropSchema.Type;
	readonly maximumSelections: number;
	readonly minimumSelections: number;
	readonly setProbability: number;
}) => {
	const oneSelection = withZeroQuantityProbability({
		distribution: makeUniformQuantityDistribution(drop.quantity),
		probability: candidateProbability,
	});
	const selectionCount = maximumSelections - minimumSelections + 1;
	const selectedSetDistribution = mixQuantityDistributions(
		Array.from(
			{
				length: selectionCount,
			},
			(_, index) => ({
				distribution: repeatQuantityDistribution(oneSelection, minimumSelections + index),
				probability: 1 / selectionCount,
			}),
		),
	);
	return withZeroQuantityProbability({
		distribution: selectedSetDistribution,
		probability: setProbability,
	});
};

/** Enumerates every positive-probability authored output occurrence without rolling it. */
const readOutputWitnesses = (output: OutputSchema.Type | undefined): OutputWitness[] => {
	if (output === undefined) return [];
	const witnesses: OutputWitness[] = [];
	const totalSetWeight = output.set.reduce((total, set) => total + set.weight, 0);

	for (const [setIndex, set] of output.set.entries()) {
		const setProbability = set.weight / totalSetWeight;
		for (const [rollIndex, roll] of set.roll.entries()) {
			if (roll.type === "chance" && roll.chance === 0) continue;
			if (roll.type === "weight") {
				const totalCandidateWeight = roll.drop.reduce(
					(total, candidate) => total + candidate.weight,
					0,
				);
				for (const [candidateIndex, candidate] of roll.drop.entries()) {
					const candidateProbability = candidate.weight / totalCandidateWeight;
					for (const [dropIndex, drop] of candidate.drop.entries()) {
						witnesses.push(
							readDropWitness({
								distribution: readWeightedOccurrenceDistribution({
									candidateProbability,
									drop,
									maximumSelections: roll.quantity.max,
									minimumSelections: roll.quantity.min,
									setProbability,
								}),
								drop,
								selection: "weighted",
								witness: {
									candidateIndex,
									dropIndex,
									rollIndex,
									setIndex,
								},
								witnessId: makeStableId(
									"set",
									setIndex,
									"roll",
									rollIndex,
									"candidate",
									candidateIndex,
									"drop",
									dropIndex,
								),
							}),
						);
					}
				}
				continue;
			}

			for (const [dropIndex, drop] of roll.drop.entries()) {
				const occurrenceProbability =
					setProbability * (roll.type === "chance" ? roll.chance : 1);
				witnesses.push(
					readDropWitness({
						distribution: withZeroQuantityProbability({
							distribution: makeUniformQuantityDistribution(drop.quantity),
							probability: occurrenceProbability,
						}),
						drop,
						selection: roll.type === "chance" ? "chance" : "guaranteed",
						witness: {
							dropIndex,
							rollIndex,
							setIndex,
						},
						witnessId: makeStableId(
							"set",
							setIndex,
							"roll",
							rollIndex,
							"drop",
							dropIndex,
						),
					}),
				);
			}
		}
	}

	return witnesses;
};

const canLineEverRun = (line: LineSchema.Type) =>
	line.enable || line.rules.some((rule) => rule.type === "enable");

const readLineDescriptor = (
	owner: ItemSchema.Type,
	line: LineSchema.Type,
): LineDescriptor | undefined => {
	if (!canLineEverRun(line)) return undefined;

	const allOf: PlannerAcquisitionRequirement[] = [
		{
			itemId: owner.id,
			minimumQuantity: 1,
			source: "owner",
			usage: "presence",
		},
	];
	const chargeCostsByItemId = new Map<IdSchema.Type, number[]>();
	const addCharge = (itemId: IdSchema.Type, chargeCost: number, inputIndex: number) => {
		const costs = chargeCostsByItemId.get(itemId) ?? [];
		costs.push(chargeCost);
		chargeCostsByItemId.set(itemId, costs);
		allOf.push({
			chargeCost,
			inputIndex,
			itemId,
			minimumQuantity: 1,
			source: "charged-item",
			usage: "charge",
		});
	};

	for (const [inputIndex, input] of line.input.entries()) {
		if (input.type === "deposit" && input.charges === undefined) return undefined;

		if (input.type === "materials") {
			allOf.push({
				inputIndex,
				itemId: input.selector.itemId,
				minimumQuantity: input.quantity.min,
				source: "material-input",
				usage: input.mode === "consume" ? "consume" : "reserve",
			});
		}
		if (input.type === "deposit") {
			allOf.push({
				chargeCost: input.charges?.cost,
				inputIndex,
				itemId: input.query.selector.itemId,
				minimumQuantity: 1,
				source: "deposit-input",
				usage: input.charges?.from === "target" ? "charge" : "presence",
			});
		}

		if (input.charges === undefined) continue;
		if (input.charges.from === "self") {
			addCharge(owner.id, input.charges.cost, inputIndex);
			continue;
		}
		if (input.type !== "deposit") return undefined;
		addCharge(input.query.selector.itemId, input.charges.cost, inputIndex);
	}

	return {
		action: {
			kind: "line",
			lineId: line.id,
			ownerItemId: owner.id,
		},
		chargeCostsByItemId: new Map(
			[
				...chargeCostsByItemId,
			].map(([itemId, costs]) => [
				itemId,
				[
					...costs,
				].sort((left, right) => left - right),
			]),
		),
		line,
		requirements: combineRequirements(
			{
				allOf,
				anyOf: [],
			},
			readAvailabilityRequirements(line.rules, "line-condition"),
		),
	};
};

const makeLineOutputRoutes = (descriptor: LineDescriptor): PlannerAcquisitionRoute[] =>
	readOutputWitnesses(descriptor.line.output).map(
		({ output, requirements }): PlannerAcquisitionRoute => ({
			action: descriptor.action,
			id: makeStableId(
				"line-output",
				descriptor.action.ownerItemId,
				descriptor.action.lineId,
				output.witnessId,
				output.itemId,
			),
			kind: "line-output",
			output,
			requirements: combineRequirements(descriptor.requirements, requirements),
		}),
	);

const makeChargeDepletionRoutes = (
	config: GameConfigSchema.Type,
	descriptor: LineDescriptor,
): PlannerAcquisitionRoute[] => {
	const routes: PlannerAcquisitionRoute[] = [];
	for (const [chargedItemId, chargeCosts] of descriptor.chargeCostsByItemId) {
		const charges = config.items[chargedItemId]?.charges;
		if (charges?.output === undefined) continue;
		if (!chargeCosts.some((cost) => cost <= charges.amount)) continue;

		const maximumSpendPerRun = chargeCosts.reduce((total, cost) => total + cost, 0);
		const minimumRunsLowerBound = Math.max(1, Math.ceil(charges.amount / maximumSpendPerRun));
		const payerRequirement: PlannerAcquisitionRequirements = {
			allOf: [
				{
					itemId: chargedItemId,
					minimumQuantity: 1,
					source: "charged-item",
					usage: "charge",
				},
			],
			anyOf: [],
		};

		for (const { output, requirements } of readOutputWitnesses(charges.output)) {
			routes.push({
				action: descriptor.action,
				chargedItemId,
				chargeCosts,
				id: makeStableId(
					"line-charge-depletion",
					descriptor.action.ownerItemId,
					descriptor.action.lineId,
					chargedItemId,
					output.witnessId,
					output.itemId,
				),
				kind: "line-charge-depletion",
				minimumRunsLowerBound,
				output,
				requirements: combineRequirements(
					descriptor.requirements,
					payerRequirement,
					requirements,
				),
			});
		}
	}
	return routes;
};

const makeMergeRoutes = (source: ItemSchema.Type): PlannerAcquisitionRoute[] => {
	const routes: PlannerAcquisitionRoute[] = [];
	const matchedTargetItemIds = new Set<IdSchema.Type>();

	for (const [mergeIndex, merge] of (source.merge ?? []).entries()) {
		const targetItemId = merge.target.itemId;
		if (matchedTargetItemIds.has(targetItemId)) continue;
		matchedTargetItemIds.add(targetItemId);

		const action = {
			kind: "merge",
			mergeIndex,
			sourceItemId: source.id,
			targetItemId,
		} as const;
		const requirements = normalizeRequirements({
			allOf: [
				{
					itemId: source.id,
					minimumQuantity: 1,
					source: "merge-source",
					usage: merge.action === "consume" ? "consume" : "presence",
				},
				{
					itemId: targetItemId,
					minimumQuantity: 1,
					source: "merge-target",
					usage: merge.effect === "keep" ? "presence" : "consume",
				},
			],
			anyOf: [],
		});

		if (merge.effect === "replace") {
			const output: PlannerAcquisitionOutput = {
				expectedQuantity: 1,
				itemId: merge.result,
				maximumQuantity: 1,
				maximumQuantityProbability: 1,
				occurrenceProbability: 1,
				quantityDistribution: makeConstantQuantityDistribution(1),
				selection: "replacement",
				stochastic: false,
				witnessId: "replacement",
			};
			routes.push({
				action,
				id: makeStableId(
					"merge-replacement",
					source.id,
					targetItemId,
					mergeIndex,
					merge.result,
				),
				kind: "merge-output",
				output,
				requirements,
				source: "replacement",
			});
		}

		for (const { output, requirements: outputRequirements } of readOutputWitnesses(
			merge.output,
		)) {
			routes.push({
				action,
				id: makeStableId(
					"merge-output",
					source.id,
					targetItemId,
					mergeIndex,
					output.witnessId,
					output.itemId,
				),
				kind: "merge-output",
				output,
				requirements: combineRequirements(requirements, outputRequirements),
				source: "output",
			});
		}
	}

	return routes;
};

const makeTemporaryExpiryRoutes = (item: ItemSchema.Type): PlannerAcquisitionRoute[] => {
	if (item.type !== "temporary") return [];
	const requirements: PlannerAcquisitionRequirements = {
		allOf: [
			{
				itemId: item.id,
				minimumQuantity: 1,
				source: "temporary-item",
				usage: "consume",
			},
		],
		anyOf: [],
	};

	return readOutputWitnesses(item.output).map(
		({ output, requirements: outputRequirements }): PlannerAcquisitionRoute => ({
			action: {
				itemId: item.id,
				kind: "temporary-expiry",
			},
			id: makeStableId("temporary-expiry", item.id, output.witnessId, output.itemId),
			kind: "temporary-expiry",
			output,
			requirements: combineRequirements(requirements, outputRequirements),
		}),
	);
};

/** Reads every positive-probability authored action branch that may acquire an item. */
export const readPlannerAcquisitionRoutes = (
	config: GameConfigSchema.Type,
): ReadonlyArray<PlannerAcquisitionRoute> => {
	const lineDescriptors = Object.values(config.items).flatMap((item) =>
		readItemLines(item).flatMap((line) => {
			const descriptor = readLineDescriptor(item, line);
			return descriptor === undefined
				? []
				: [
						descriptor,
					];
		}),
	);

	return [
		...lineDescriptors.flatMap(makeLineOutputRoutes),
		...lineDescriptors.flatMap((descriptor) => makeChargeDepletionRoutes(config, descriptor)),
		...Object.values(config.items).flatMap(makeMergeRoutes),
		...Object.values(config.items).flatMap(makeTemporaryExpiryRoutes),
	].sort((left, right) => compareIds(left.id, right.id));
};

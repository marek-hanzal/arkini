import type {
	EditorAcquisitionOperation,
	EditorAcquisitionRequirement,
	EditorAcquisitionRoute,
} from "~/editor/EditorAcquisitionGraph";
import { readEditorAcquisitionAvailabilityRequirementsFn } from "~/editor/acquisition/fn/readEditorAcquisitionAvailabilityRequirementsFn";
import { readEditorAcquisitionOutputOccurrencesFn } from "~/editor/acquisition/fn/readEditorAcquisitionOutputOccurrencesFn";
import type { IdSchema } from "~/engine/common/schema/IdSchema";
import type { ItemSchema } from "~/engine/item/schema/ItemSchema";
import { readAuthoredItemLinesFn } from "~/engine/line/fn/readAuthoredItemLinesFn";
import type { LineSchema } from "~/engine/line/schema/LineSchema";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

const combineRequirements = (
	...groups: ReadonlyArray<EditorAcquisitionRoute["requirements"]>
): EditorAcquisitionRoute["requirements"] => ({
	allOf: groups.flatMap(({ allOf }) => allOf),
	anyOf: groups.flatMap(({ anyOf }) => anyOf),
	unsupported: groups.flatMap(({ unsupported }) => unsupported ?? []),
});

const makeChargeDepletionRequirements = (
	requirements: EditorAcquisitionRoute["requirements"],
	chargedItemId: string,
): EditorAcquisitionRoute["requirements"] => ({
	...requirements,
	allOf: [
		...requirements.allOf.filter(
			(requirement) =>
				requirement.factId !== chargedItemId ||
				(requirement.source !== "charged-item" &&
					requirement.source !== "deposit-input" &&
					requirement.source !== "owner"),
		),
		{
			factId: chargedItemId,
			quantity: 1,
			source: "charged-item",
			usage: "consume",
		},
	],
});

interface ChargeCost {
	readonly cost: number;
	readonly from: "self" | "target";
}

interface LineDescriptor {
	readonly chargeCostsByItemId: ReadonlyMap<IdSchema.Type, ReadonlyArray<ChargeCost>>;
	readonly line: LineSchema.Type;
	readonly operation: EditorAcquisitionOperation;
	readonly owner: ItemSchema.Type;
	readonly requirements: EditorAcquisitionRoute["requirements"];
}

const readLineOperationInputs = (line: LineSchema.Type) =>
	line.input.flatMap((input) => {
		switch (input.type) {
			case "simple":
				return [];
			case "materials":
				return [
					{
						factId: input.selector.itemId,
						quantity: input.quantity,
					},
				];
			case "deposit":
				return [
					{
						factId: input.query.selector.itemId,
						quantity: {
							max: 1,
							min: 1,
						},
					},
				];
		}
	});

const readLineDescriptorFn = (owner: ItemSchema.Type, line: LineSchema.Type) => {
	if (!line.enable && !line.rules.some(({ type }) => type === "enable")) return undefined;
	const requirements: EditorAcquisitionRequirement[] = [
		{
			factId: owner.id,
			quantity: 1,
			source: "owner",
			usage: "one-time",
		},
	];
	const chargeCostsByItemId = new Map<string, ChargeCost[]>();
	const addCharge = (itemId: string, cost: ChargeCost) => {
		const costs = chargeCostsByItemId.get(itemId) ?? [];
		costs.push(cost);
		chargeCostsByItemId.set(itemId, costs);
	};

	for (const input of line.input) {
		if (input.type === "materials")
			requirements.push({
				factId: input.selector.itemId,
				quantity: input.quantity.min,
				source: "material-input",
				usage: input.mode === "consume" ? "consume" : "ongoing",
			});
		if (input.type === "deposit")
			requirements.push({
				factId: input.query.selector.itemId,
				quantity: 1,
				source: "deposit-input",
				usage: "one-time",
			});
		if (input.charges === undefined) continue;
		if (input.charges.from === "self")
			addCharge(owner.id, {
				cost: input.charges.cost,
				from: "self",
			});
		else if (input.type === "deposit")
			addCharge(input.query.selector.itemId, {
				cost: input.charges.cost,
				from: "target",
			});
		else continue;
	}

	const availability = readEditorAcquisitionAvailabilityRequirementsFn({
		rules: line.rules,
		source: "line-condition",
	});
	return {
		chargeCostsByItemId,
		line,
		operation: {
			id: `source:${owner.id}:line:${line.id}`,
			inputs: readLineOperationInputs(line),
		},
		owner,
		requirements: combineRequirements(
			{
				allOf: requirements,
				anyOf: [],
			},
			availability,
		),
	} satisfies LineDescriptor;
};

const readLineRoutesFn = (config: GameConfigSchema.Type, descriptor: LineDescriptor) => {
	const routes: EditorAcquisitionRoute[] = [];
	const chargeUses: NonNullable<EditorAcquisitionRoute["chargeUses"]>[number][] = [];
	for (const [chargedItemId, costs] of descriptor.chargeCostsByItemId) {
		const charges = config.items[chargedItemId]?.charges;
		const spendPerRun = costs.reduce((total, { cost }) => total + cost, 0);
		if (charges === undefined || spendPerRun <= 0) continue;
		const accounting =
			spendPerRun <= charges.amount &&
			new Set(costs.map(({ cost }) => cost)).size === 1 &&
			new Set(costs.map(({ from }) => from)).size === 1
				? "single-payer-exact"
				: "multi-payer-unsupported";
		chargeUses.push({
			accounting,
			payerFactId: chargedItemId,
			usableActionRuns:
				accounting === "single-payer-exact" ? Math.floor(charges.amount / spendPerRun) : 0,
		});
	}
	const outputModel = readEditorAcquisitionOutputOccurrencesFn(descriptor.line.output);
	for (const occurrence of outputModel.occurrences)
		routes.push({
			...(chargeUses.length === 0
				? {}
				: {
						chargeUses,
					}),
			durationMs: descriptor.line.runtimeMs,
			id: `line-output:${descriptor.owner.id}:${descriptor.line.id}:${occurrence.id}:${occurrence.factId}`,
			metadata: {
				kind: "line-output",
				lineId: descriptor.line.id,
				lineTitle: descriptor.line.title,
				ownerItemId: descriptor.owner.id,
			},
			operation: descriptor.operation,
			output: {
				annotation: occurrence.annotation,
				expectedYield: occurrence.expectedYield,
				factId: occurrence.factId,
			},
			requirements: combineRequirements(descriptor.requirements, occurrence.requirements),
			runMultiplier: 1,
		});

	for (const [chargedItemId, costs] of descriptor.chargeCostsByItemId) {
		const charges = config.items[chargedItemId]?.charges;
		const spendPerRun = costs.reduce((total, { cost }) => total + cost, 0);
		if (charges?.output === undefined || spendPerRun > charges.amount) continue;
		if (charges.amount % spendPerRun !== 0) continue;
		const runMultiplier = charges.amount / spendPerRun;
		const chargeOutputModel = readEditorAcquisitionOutputOccurrencesFn(charges.output);
		for (const occurrence of chargeOutputModel.occurrences)
			routes.push({
				chargeUses: chargeUses.filter(({ payerFactId }) => payerFactId !== chargedItemId),
				durationMs: descriptor.line.runtimeMs,
				id: `line-charge-depletion:${descriptor.owner.id}:${descriptor.line.id}:${chargedItemId}:${occurrence.id}:${occurrence.factId}`,
				metadata: {
					chargedItemId,
					kind: "line-charge-depletion",
					lineId: descriptor.line.id,
					lineTitle: descriptor.line.title,
					ownerItemId: descriptor.owner.id,
				},
				operation: {
					id: `source:${chargedItemId}:charges`,
					inputs: [],
				},
				output: {
					annotation: occurrence.annotation,
					expectedYield: occurrence.expectedYield,
					factId: occurrence.factId,
				},
				requirements: combineRequirements(
					makeChargeDepletionRequirements(descriptor.requirements, chargedItemId),
					occurrence.requirements,
				),
				runMultiplier,
			});
	}
	return routes;
};

/** Compiles line-output and exact charge-depletion acquisition routes. */
export const compileEditorAcquisitionLineRoutesFn = (config: GameConfigSchema.Type) => {
	const routes: EditorAcquisitionRoute[] = [];
	for (const item of Object.values(config.items))
		for (const line of readAuthoredItemLinesFn(item)) {
			const descriptor = readLineDescriptorFn(item, line);
			if (descriptor !== undefined) routes.push(...readLineRoutesFn(config, descriptor));
		}
	return routes;
};

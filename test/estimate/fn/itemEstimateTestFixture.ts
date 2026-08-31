import type {
	AcquisitionGraph,
	AcquisitionRequirement,
	AcquisitionRoute,
} from "~/flow/type/AcquisitionGraph";
import { estimateRequestsFn } from "~/estimate/fn/estimateRequestsFn";

const requirement = (
	factId: string,
	usage: AcquisitionRequirement["usage"] = "consume",
	quantity = 1,
	identity?: AcquisitionRequirement["identity"],
): AcquisitionRequirement => ({
	factId,
	...(identity === undefined
		? {}
		: {
				identity,
			}),
	quantity,
	source: "material-input",
	usage,
});

const route = ({
	allOf = [],
	anyOf = [],
	chargeUses,
	durationMs,
	id,
	operation,
	operationOutputGroupId,
	output,
	outputQuantity = 1,
	quantityDistribution,
	runMultiplier = 1,
}: {
	readonly allOf?: ReadonlyArray<AcquisitionRequirement>;
	readonly anyOf?: ReadonlyArray<ReadonlyArray<AcquisitionRequirement>>;
	readonly chargeUses?: AcquisitionRoute["chargeUses"];
	readonly durationMs: number;
	readonly id: string;
	readonly operation?: AcquisitionRoute["operation"];
	readonly operationOutputGroupId?: string;
	readonly output: string;
	readonly outputQuantity?: number;
	readonly quantityDistribution?: AcquisitionRoute["output"]["quantityDistribution"];
	readonly runMultiplier?: number;
}): AcquisitionRoute => ({
	...(chargeUses === undefined
		? {}
		: {
				chargeUses,
			}),
	durationMs,
	id,
	metadata: {
		kind: "line-output",
		lineId: id,
		lineTitle: id,
		ownerItemId: "owner",
	},
	...(operation === undefined
		? {}
		: {
				operation,
			}),
	output: {
		annotation: {
			alternativeSet: false,
			placement: "drop",
			quantity: {
				max: outputQuantity,
				min: outputQuantity,
			},
			selectionKind: "guaranteed",
		},
		factId: output,
		...(operationOutputGroupId === undefined
			? {}
			: {
					operationOutputGroupId,
				}),
		quantityDistribution: quantityDistribution ?? [
			{
				probability: 1,
				quantity: outputQuantity,
			},
		],
	},
	runMultiplier,
	requirements: {
		allOf,
		anyOf,
	},
});

const graph = ({
	facts,
	roots,
	routes,
}: {
	readonly facts: ReadonlyArray<string>;
	readonly roots: ReadonlyArray<
		| string
		| {
				readonly factId: string;
				readonly quantity: number;
		  }
	>;
	readonly routes: ReadonlyArray<AcquisitionRoute>;
}): AcquisitionGraph => ({
	factIds: facts,
	limitations: [],
	roots: roots.map((root) =>
		typeof root === "string"
			? {
					factId: root,
					quantity: "unbounded" as const,
				}
			: root,
	),
	routes,
});

const estimate = (dependencyGraph: AcquisitionGraph, factId = "target", quantity = 1) =>
	estimateRequestsFn({
		graph: dependencyGraph,
		requests: [
			{
				factId,
				quantity,
			},
		],
	})[0]!;

/** Minimal authored-graph vocabulary shared by estimator contract tests. */
export const itemEstimateTestFixture = {
	estimate,
	graph,
	requirement,
	route,
} as const;

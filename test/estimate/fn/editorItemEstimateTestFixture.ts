import type {
	EditorAcquisitionGraph,
	EditorAcquisitionRequirement,
	EditorAcquisitionRoute,
} from "~/flow/type/EditorAcquisitionGraph";
import { estimateEditorItemsFn } from "~/estimate/fn/estimateEditorItemsFn";

const requirement = (
	factId: string,
	usage: EditorAcquisitionRequirement["usage"] = "consume",
	quantity = 1,
	identity?: EditorAcquisitionRequirement["identity"],
): EditorAcquisitionRequirement => ({
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
	readonly allOf?: ReadonlyArray<EditorAcquisitionRequirement>;
	readonly anyOf?: ReadonlyArray<ReadonlyArray<EditorAcquisitionRequirement>>;
	readonly chargeUses?: EditorAcquisitionRoute["chargeUses"];
	readonly durationMs: number;
	readonly id: string;
	readonly operation?: EditorAcquisitionRoute["operation"];
	readonly operationOutputGroupId?: string;
	readonly output: string;
	readonly outputQuantity?: number;
	readonly quantityDistribution?: EditorAcquisitionRoute["output"]["quantityDistribution"];
	readonly runMultiplier?: number;
}): EditorAcquisitionRoute => ({
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
	readonly routes: ReadonlyArray<EditorAcquisitionRoute>;
}): EditorAcquisitionGraph => ({
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

const estimate = (dependencyGraph: EditorAcquisitionGraph, factId = "target", quantity = 1) =>
	estimateEditorItemsFn({
		graph: dependencyGraph,
		requests: [
			{
				factId,
				quantity,
			},
		],
	})[0]!;

/** Minimal authored-graph vocabulary shared by estimator contract tests. */
export const editorItemEstimateTestFixture = {
	estimate,
	graph,
	requirement,
	route,
} as const;

import { Effect } from "effect";

import type {
	EditorAcquisitionGraph,
	EditorAcquisitionRequirement,
	EditorAcquisitionRoute,
} from "~/editor/EditorAcquisitionGraph";
import { estimateEditorItemFx } from "~/editor/estimator/estimateEditorItemFx";

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
	runMultiplier: 1,
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
	readonly roots: ReadonlyArray<string>;
	readonly routes: ReadonlyArray<EditorAcquisitionRoute>;
}): EditorAcquisitionGraph => ({
	factIds: facts,
	limitations: [],
	roots: roots.map((factId) => ({
		factId,
		quantity: "unbounded",
	})),
	routes,
});

const estimate = (dependencyGraph: EditorAcquisitionGraph, factId = "target", quantity = 1) =>
	Effect.runSync(
		estimateEditorItemFx({
			factId,
			graph: dependencyGraph,
			quantity,
		}),
	);

/** Minimal authored-graph vocabulary shared by estimator contract tests. */
export const editorItemEstimateTestFixture = {
	estimate,
	graph,
	requirement,
	route,
} as const;

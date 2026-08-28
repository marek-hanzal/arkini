import type {
	EditorAcquisitionGraph,
	EditorAcquisitionRequirement,
	EditorAcquisitionRoute,
} from "~/editor/EditorAcquisitionGraph";
import { estimateEditorItemsFn } from "~/editor/estimator/fn/estimateEditorItemsFn";

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
	durationMs,
	expectedYield = 1,
	id,
	output,
	runMultiplier = 1,
}: {
	readonly allOf?: ReadonlyArray<EditorAcquisitionRequirement>;
	readonly anyOf?: ReadonlyArray<ReadonlyArray<EditorAcquisitionRequirement>>;
	readonly durationMs: number;
	readonly expectedYield?: number;
	readonly id: string;
	readonly output: string;
	readonly runMultiplier?: number;
}): EditorAcquisitionRoute => ({
	durationMs,
	id,
	metadata: {
		kind: "line-output",
		lineId: id,
		lineTitle: id,
		ownerItemId: "owner",
	},
	output: {
		annotation: {
			alternativeSet: false,
			placement: "drop",
			quantity: {
				max: expectedYield,
				min: expectedYield,
			},
			selectionKind: "guaranteed",
		},
		expectedYield,
		factId: output,
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

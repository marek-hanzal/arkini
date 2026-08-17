import type {
	EditorEstimateQuantityProbability,
	EditorEstimateRequirement,
} from "~/editor/estimator/EditorEstimateDependencyGraph";

export interface EditorEstimateOutputOccurrence {
	readonly factId: string;
	readonly id: string;
	readonly quantityDistribution: ReadonlyArray<EditorEstimateQuantityProbability>;
	readonly requirements: {
		readonly allOf: ReadonlyArray<EditorEstimateRequirement>;
		readonly anyOf: ReadonlyArray<ReadonlyArray<EditorEstimateRequirement>>;
	};
}

import { Effect } from "effect";

import type {
	EditorAcquisitionGraph,
	EditorAcquisitionRequirement,
	EditorAcquisitionRoute,
} from "~/editor/EditorAcquisitionGraph";
import { createEditorEstimateComponentIndexFx } from "~/editor/estimator/createEditorEstimateComponentIndexFx";

const conditionRequirementSources = new Set<EditorAcquisitionRequirement["source"]>([
	"line-condition",
	"output-condition",
]);

const projectRequirement = (
	requirement: EditorAcquisitionRequirement,
): EditorAcquisitionRequirement =>
	requirement.source === "charged-item"
		? {
				...requirement,
				quantity: 1,
				usage: "one-time",
			}
		: requirement;

const projectEstimateRequirements = (route: EditorAcquisitionRoute) => ({
	// Positive enable facts are hard acquisition prerequisites even though Estimate does not
	// evaluate rule truth. Disable-rule alternatives remain outside the optimistic time model.
	allOf: route.requirements.allOf.map(projectRequirement),
	anyOf: route.requirements.anyOf
		.map((clause) => clause.filter(({ source }) => !conditionRequirementSources.has(source)))
		.map((clause) => clause.map(projectRequirement))
		.filter((clause) => clause.length > 0),
});

interface EditorEstimateIndex {
	readonly factIds: ReadonlySet<string>;
	readonly factCount: number;
	readonly roots: ReadonlyMap<string, number | "unbounded">;
	readonly routesByFact: ReadonlyMap<string, ReadonlyArray<EditorAcquisitionRoute>>;
	readonly estimateRequirementsByRoute: ReadonlyMap<
		EditorAcquisitionRoute,
		ReturnType<typeof projectEstimateRequirements>
	>;
	readonly unsupportedRoutes: ReadonlySet<EditorAcquisitionRoute>;
	readonly componentByFact: ReadonlyMap<string, string>;
	readonly seededComponentByFact: ReadonlyMap<string, string>;
}

/** Indexes immutable graph facts, authored requirements, and component topology. */
export const createEditorEstimateIndexFx = Effect.fn("createEditorEstimateIndexFx")(
	(graph: EditorAcquisitionGraph) =>
		Effect.gen(function* () {
			const roots = new Map(
				graph.roots.map(
					({ factId, quantity }) =>
						[
							factId,
							quantity,
						] as const,
				),
			);
			const estimateRequirementsByRoute = new Map(
				graph.routes.map(
					(route) =>
						[
							route,
							projectEstimateRequirements(route),
						] as const,
				),
			);
			const routesByFact = new Map<string, EditorAcquisitionRoute[]>();
			for (const route of graph.routes) {
				const routes = routesByFact.get(route.output.factId) ?? [];
				routes.push(route);
				routesByFact.set(route.output.factId, routes);
			}
			for (const routes of routesByFact.values())
				routes.sort((left, right) => left.id.localeCompare(right.id));
			const { componentByFact, seededComponentByFact } =
				yield* createEditorEstimateComponentIndexFx({
					dependencyEdges: graph.routes
						.filter(
							(route) =>
								route.operation?.outputCompilation !== "state-space-unsupported",
						)
						.flatMap((route) =>
							[
								...(estimateRequirementsByRoute.get(route)?.allOf ?? []),
								...(estimateRequirementsByRoute.get(route)?.anyOf ?? []).flat(),
							].map(
								({ factId }) =>
									[
										route.output.factId,
										factId,
									] as const,
							),
						),
					factIds: graph.factIds,
					rootFactIds: new Set(graph.roots.map(({ factId }) => factId)),
				});
			return {
				factIds: new Set(graph.factIds),
				factCount: graph.factIds.length,
				roots,
				routesByFact,
				estimateRequirementsByRoute,
				unsupportedRoutes: new Set(
					graph.routes.filter(
						(route) => route.operation?.outputCompilation === "state-space-unsupported",
					),
				),
				componentByFact,
				seededComponentByFact,
			} satisfies EditorEstimateIndex;
		}),
);

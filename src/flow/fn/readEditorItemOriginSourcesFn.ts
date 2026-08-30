import type {
	EditorAcquisitionGraph,
	EditorAcquisitionRoute,
} from "~/flow/type/EditorAcquisitionGraph";
import type {
	EditorItemOriginInputOccurrence,
	EditorItemOriginOutputRequirements,
	EditorItemOriginRequirementOccurrence,
	EditorItemOriginSource,
	EditorItemOriginSourceReference,
} from "~/flow/type/EditorItemOriginSource";

const unique = <Value>(values: ReadonlyArray<Value>): Value[] => [
	...new Set(values),
];

const readOwnerItemId = (route: EditorAcquisitionRoute) => {
	switch (route.metadata.kind) {
		case "line-output":
			return route.metadata.ownerItemId;
		case "line-charge-depletion":
			return route.metadata.chargedItemId;
		case "merge-output":
			return route.metadata.sourceItemId;
		case "temporary-expiry":
			return route.metadata.itemId;
	}
};

const readReference = (route: EditorAcquisitionRoute): EditorItemOriginSourceReference => {
	switch (route.metadata.kind) {
		case "line-output":
			return {
				lineId: route.metadata.lineId,
				type: "line",
			};
		case "line-charge-depletion":
			return {
				type: "charges",
			};
		case "merge-output":
			return {
				ruleNumber: route.metadata.mergeIndex + 1,
				type: "merge",
			};
		case "temporary-expiry":
			return {
				type: "expiry",
			};
	}
};

const readInputOccurrences = (
	routes: ReadonlyArray<EditorAcquisitionRoute>,
): EditorItemOriginInputOccurrence[] => {
	const inputs =
		routes[0]?.operation?.inputs.map(({ factId, quantity }) => ({
			itemId: factId,
			quantity,
		})) ?? [];
	const seen = new Set<string>();
	return inputs.filter(({ itemId, quantity }) => {
		const key = `${itemId}:${quantity.min}:${quantity.max}`;
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
};

const readRequirementOccurrence = (
	requirement: EditorAcquisitionRoute["requirements"]["allOf"][number],
): EditorItemOriginRequirementOccurrence => ({
	itemId: requirement.factId,
	quantity: {
		max: requirement.quantity,
		min: requirement.quantity,
	},
	...(requirement.identity === undefined
		? {}
		: {
				identity: requirement.identity,
			}),
	sources: [
		requirement.source,
	],
	usage: requirement.usage,
});

const readOutputRequirements = (
	route: EditorAcquisitionRoute,
): EditorItemOriginOutputRequirements => ({
	allOf: route.requirements.allOf.map(readRequirementOccurrence),
	anyOf: route.requirements.anyOf.map((clause) => clause.map(readRequirementOccurrence)),
	...(route.requirements.unsupported === undefined
		? {}
		: {
				unsupported: route.requirements.unsupported.map(({ factId, reason, source }) => ({
					itemId: factId,
					reason,
					source,
				})),
			}),
});

const readLabel = (route: EditorAcquisitionRoute) => {
	switch (route.metadata.kind) {
		case "line-output":
			return route.metadata.lineTitle;
		case "line-charge-depletion":
			return "Depletion";
		case "merge-output":
			return "Merge";
		case "temporary-expiry":
			return "Expiry";
	}
};

const readKind = (route: EditorAcquisitionRoute): EditorItemOriginSource["kind"] => {
	switch (route.metadata.kind) {
		case "line-output":
			return "line";
		case "line-charge-depletion":
			return "charges";
		case "merge-output":
			return "merge";
		case "temporary-expiry":
			return "expiry";
	}
};

const readRuntimeMs = (route: EditorAcquisitionRoute) =>
	route.metadata.kind === "merge-output" || route.metadata.kind === "line-charge-depletion"
		? undefined
		: route.durationMs;

const readRequirementItemIds = (
	ownerItemId: string,
	routes: ReadonlyArray<EditorAcquisitionRoute>,
) =>
	unique([
		ownerItemId,
		...routes.flatMap((route) => route.operation?.inputs.map(({ factId }) => factId) ?? []),
		...routes.flatMap((route) =>
			(route.chargeUses ?? []).map(({ payerFactId }) => payerFactId),
		),
		...routes.flatMap((route) => route.requirements.allOf.map(({ factId }) => factId)),
		...routes.flatMap((route) =>
			route.requirements.anyOf.flatMap((clause) => clause.map(({ factId }) => factId)),
		),
		...routes.flatMap((route) =>
			(route.requirements.unsupported ?? []).map(({ factId }) => factId),
		),
	]);

const readOutputs = (routes: ReadonlyArray<EditorAcquisitionRoute>) => {
	const seen = new Set<string>();
	return routes.flatMap((route) => {
		const output = {
			itemId: route.output.factId,
			placement: route.output.annotation.placement,
			quantity: route.output.annotation.quantity,
			routeId: route.id,
			requirements: readOutputRequirements(route),
			selectionKind: route.output.annotation.selectionKind,
			weightedSet: route.output.annotation.alternativeSet,
		};
		const key = route.id;
		if (seen.has(key)) return [];
		seen.add(key);
		return [
			output,
		];
	});
};

type EditorAcquisitionRouteGroup = [
	EditorAcquisitionRoute,
	...EditorAcquisitionRoute[],
];

const projectRoutes = (routes: EditorAcquisitionRouteGroup): EditorItemOriginSource => {
	const route = routes[0];
	const ownerItemId = readOwnerItemId(route);
	const runtimeMs = readRuntimeMs(route);
	return {
		id: route.operation?.id ?? route.id,
		inputs: readInputOccurrences(routes),
		kind: readKind(route),
		label: readLabel(route),
		outputs: readOutputs(routes),
		ownerItemId,
		reference: readReference(route),
		requirementItemIds: readRequirementItemIds(ownerItemId, routes),
		routeIds: routes.map(({ id }) => id),
		...(runtimeMs === undefined
			? {}
			: {
					runtimeMs,
				}),
	};
};

/** Groups canonical output-occurrence routes into their authored item-origin operations. */
export const readEditorItemOriginSourcesFn = (graph: EditorAcquisitionGraph) => {
	const routesByOperationId = new Map<string, EditorAcquisitionRouteGroup>();
	for (const route of graph.routes) {
		const operationId = route.operation?.id ?? route.id;
		const routes = routesByOperationId.get(operationId);
		if (routes === undefined) {
			routesByOperationId.set(operationId, [
				route,
			]);
			continue;
		}
		routes.push(route);
	}
	return [
		...routesByOperationId.values(),
	].map(projectRoutes);
};

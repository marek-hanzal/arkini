import type { AcquisitionGraph, AcquisitionRoute } from "~/flow/type/AcquisitionGraph";
import type {
	ItemOriginInputOccurrence,
	ItemOriginOutputRequirements,
	ItemOriginRequirementOccurrence,
	ItemOriginSource,
	ItemOriginSourceReference,
} from "~/flow/type/ItemOriginSource";

const uniqueFn = <Value>(values: ReadonlyArray<Value>): Value[] => [
	...new Set(values),
];

const readOwnerItemIdFn = (route: AcquisitionRoute) => {
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

const readReferenceFn = (route: AcquisitionRoute): ItemOriginSourceReference => {
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

const readInputOccurrencesFn = (
	routes: ReadonlyArray<AcquisitionRoute>,
): ItemOriginInputOccurrence[] => {
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

const readRequirementOccurrenceFn = (
	requirement: AcquisitionRoute["requirements"]["allOf"][number],
): ItemOriginRequirementOccurrence => ({
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

const readOutputRequirementsFn = (route: AcquisitionRoute): ItemOriginOutputRequirements => ({
	allOf: route.requirements.allOf.map(readRequirementOccurrenceFn),
	anyOf: route.requirements.anyOf.map((clause) => clause.map(readRequirementOccurrenceFn)),
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

const readLabelFn = (route: AcquisitionRoute) => {
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

const readKindFn = (route: AcquisitionRoute): ItemOriginSource["kind"] => {
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

const readRuntimeMsFn = (route: AcquisitionRoute) =>
	route.metadata.kind === "merge-output" || route.metadata.kind === "line-charge-depletion"
		? undefined
		: route.durationMs;

const readRequirementItemIdsFn = (ownerItemId: string, routes: ReadonlyArray<AcquisitionRoute>) =>
	uniqueFn([
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

const readOutputsFn = (routes: ReadonlyArray<AcquisitionRoute>) => {
	const seen = new Set<string>();
	return routes.flatMap((route) => {
		const output = {
			itemId: route.output.factId,
			placement: route.output.annotation.placement,
			quantity: route.output.annotation.quantity,
			routeId: route.id,
			requirements: readOutputRequirementsFn(route),
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

type AcquisitionRouteGroup = [
	AcquisitionRoute,
	...AcquisitionRoute[],
];

const projectRoutesFn = (routes: AcquisitionRouteGroup): ItemOriginSource => {
	const route = routes[0];
	const ownerItemId = readOwnerItemIdFn(route);
	const runtimeMs = readRuntimeMsFn(route);
	return {
		id: route.operation?.id ?? route.id,
		inputs: readInputOccurrencesFn(routes),
		kind: readKindFn(route),
		label: readLabelFn(route),
		outputs: readOutputsFn(routes),
		ownerItemId,
		reference: readReferenceFn(route),
		requirementItemIds: readRequirementItemIdsFn(ownerItemId, routes),
		routeIds: routes.map(({ id }) => id),
		...(runtimeMs === undefined
			? {}
			: {
					runtimeMs,
				}),
	};
};

/** Groups canonical output-occurrence routes into their authored item-origin operations. */
export const readItemOriginSourcesFn = (graph: AcquisitionGraph) => {
	const routesByOperationId = new Map<string, AcquisitionRouteGroup>();
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
	].map(projectRoutesFn);
};

import { Order } from "effect";

import type { EditorAcquisitionGraph } from "~/flow/domain/EditorAcquisitionGraph";
import { compileEditorAcquisitionLineRoutesFn } from "~/flow/domain/fn/compileEditorAcquisitionLineRoutesFn";
import { compileEditorAcquisitionMergeRoutesFn } from "~/flow/domain/fn/compileEditorAcquisitionMergeRoutesFn";
import { compileEditorAcquisitionRootsFn } from "~/flow/domain/fn/compileEditorAcquisitionRootsFn";
import { compileEditorAcquisitionTemporaryRoutesFn } from "~/flow/domain/fn/compileEditorAcquisitionTemporaryRoutesFn";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

/** Composes canonical authored acquisition facts and routes in deterministic order. */
export const createEditorAcquisitionGraphFn = (config: GameConfigSchema.Type) => {
	const roots = compileEditorAcquisitionRootsFn(config);
	const routes = [
		...compileEditorAcquisitionLineRoutesFn(config),
		...compileEditorAcquisitionMergeRoutesFn(config),
		...compileEditorAcquisitionTemporaryRoutesFn(config),
	].sort((left, right) => Order.String(left.id, right.id));

	return {
		factIds: Object.keys(config.items).sort(Order.String),
		limitations: roots.limitations,
		roots: roots.roots,
		routes,
	} satisfies EditorAcquisitionGraph;
};

import { Effect } from "effect";

import type { EditorAcquisitionGraph } from "~/editor/EditorAcquisitionGraph";
import { compileEditorAcquisitionLineRoutesFx } from "~/editor/acquisition/compileEditorAcquisitionLineRoutesFx";
import { compileEditorAcquisitionMergeRoutesFx } from "~/editor/acquisition/compileEditorAcquisitionMergeRoutesFx";
import { compileEditorAcquisitionRootsFx } from "~/editor/acquisition/compileEditorAcquisitionRootsFx";
import { compileEditorAcquisitionTemporaryRoutesFx } from "~/editor/acquisition/compileEditorAcquisitionTemporaryRoutesFx";
import type { GameConfigSchema } from "~/engine/schema/GameConfigSchema";

/** Composes canonical authored acquisition facts and routes in deterministic order. */
export const createEditorAcquisitionGraphFx = Effect.fn("createEditorAcquisitionGraphFx")(
	function* (config: GameConfigSchema.Type) {
		const roots = yield* compileEditorAcquisitionRootsFx(config);
		const routes = [
			...(yield* compileEditorAcquisitionLineRoutesFx(config)),
			...(yield* compileEditorAcquisitionMergeRoutesFx(config)),
			...(yield* compileEditorAcquisitionTemporaryRoutesFx(config)),
		].sort((left, right) => left.id.localeCompare(right.id));

		return {
			factIds: Object.keys(config.items).sort((left, right) => left.localeCompare(right)),
			limitations: roots.limitations,
			roots: roots.roots,
			routes,
		} satisfies EditorAcquisitionGraph;
	},
);

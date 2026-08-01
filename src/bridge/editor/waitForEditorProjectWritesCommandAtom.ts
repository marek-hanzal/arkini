import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { ArkpackCatalogOwnerAtom } from "~/bridge/arkpack/ArkpackCatalogOwnerAtom";
import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";

/** Joins editor repository writes admitted before an editor exit proceeds. */
export const waitForEditorProjectWritesCommandAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.fn((_, get) => {
			const catalog = get(ArkpackCatalogOwnerAtom);
			return Effect.all([
				repository.awaitIdleFx,
				catalog?.awaitIdleFx ?? Effect.void,
			]).pipe(Effect.asVoid);
		}).pipe(Atom.setIdleTTL(0)),
	),
);

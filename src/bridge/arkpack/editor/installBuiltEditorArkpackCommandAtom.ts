import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";

import { ArkpackCatalogOwnerAtom } from "~/bridge/arkpack/ArkpackCatalogOwnerAtom";
import { installBuiltEditorArkpackFx } from "~/bridge/arkpack/editor/installBuiltEditorArkpackFx";
import type { EditorBuildMajorUpdateConfirmation } from "~/bridge/arkpack/editor/readEditorBuildInstallPlanFx";
import { EditorProjectRepository } from "~/bridge/editor/EditorProjectRepository";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import type { EditorProjectBuildSchema } from "~/editor/EditorProjectBuildSchema";
import type { ArkpackVersionSchema } from "~/engine/version/schema/ArkpackVersionSchema";

/** Reads and installs the exact current canonical build instead of caching artifact bytes. */
export const installBuiltEditorArkpackCommandAtom = RendererRuntime.runSync(
	Effect.map(EditorProjectRepository, (repository) =>
		Atom.family((contentHash: string) =>
			Atom.fn(
				(
					request: {
						readonly artifact: EditorProjectBuildSchema.Type;
						readonly confirmation?: EditorBuildMajorUpdateConfirmation;
						readonly targetVersion: ArkpackVersionSchema.Type;
					},
					get,
				) => {
					const { artifact } = request;
					if (artifact.contentHash !== contentHash)
						return Effect.fail(
							new Error("The selected editor build artifact is stale."),
						);
					const catalog = get(ArkpackCatalogOwnerAtom);
					if (catalog === undefined)
						return Effect.fail(new Error("Arkpack catalog is not configured."));
					return installBuiltEditorArkpackFx({
						...request,
						catalog,
						repository,
					});
				},
			).pipe(Atom.setIdleTTL(0)),
		),
	),
);

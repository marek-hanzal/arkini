import { Effect } from "effect";

import { EditorSourceFileSchema } from "~/engine/editor/schema/EditorSourceFileSchema";
import type { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";
import { validateResourceEditorSourceIdFx } from
	"~/engine/resource/editor/fx/validateResourceEditorSourceIdFx";
import type { ResourceConfigSchema } from "~/engine/resource/schema/ResourceConfigSchema";

/** Restores exact PNG IDs into `resources` or `assets` without filesystem path ambiguity. */
export const createResourceEditorSourceFilesFx = Effect.fn("createResourceEditorSourceFilesFx")(
	function* (resources: ReadonlyArray<ResourceSchema.Type>, roles: ResourceConfigSchema.Type) {
		const shellResourceIds = new Set(
			Object.values(roles).filter((value): value is string => value !== undefined),
		);
		return yield* Effect.forEach(resources, (resource) => {
			return validateResourceEditorSourceIdFx(resource.id).pipe(
				Effect.map(() =>
					EditorSourceFileSchema.parse({
						path: `${shellResourceIds.has(resource.id) ? "resources" : "assets"}/${resource.id}.png`,
						bytes: resource.bytes,
					}),
				),
			);
		});
	},
);

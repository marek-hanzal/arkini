import { Effect } from "effect";

import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";
import { EditorSourceFileSchema } from "~/engine/editor/schema/EditorSourceFileSchema";
import type { ResourceConfigSchema } from "~/engine/resource/schema/ResourceConfigSchema";
import type { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";

const portableResourceIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const windowsDeviceNamePattern = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i;

/** Restores exact PNG IDs into `resources` or `assets` without filesystem path ambiguity. */
export const createResourceEditorSourceFilesFx = Effect.fn(
	"createResourceEditorSourceFilesFx",
)(function* (
	resources: ReadonlyArray<ResourceSchema.Type>,
	roles: ResourceConfigSchema.Type,
) {
	const shellResourceIds = new Set(
		Object.values(roles).filter((value): value is string => value !== undefined),
	);
	return yield* Effect.forEach(resources, (resource) => {
		if (
			!portableResourceIdPattern.test(resource.id) ||
			windowsDeviceNamePattern.test(resource.id)
		) {
			return Effect.fail(
				new EditorProjectError({
					reason: "unsafe-resource-id",
					message: `Resource ${resource.id} cannot be represented by the filename-based source format.`,
				}),
			);
		}
		return Effect.succeed(
			EditorSourceFileSchema.parse({
				path: `${shellResourceIds.has(resource.id) ? "resources" : "assets"}/${resource.id}.png`,
				bytes: resource.bytes,
			}),
		);
	});
});

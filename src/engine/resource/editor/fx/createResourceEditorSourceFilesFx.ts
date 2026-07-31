import { Effect } from "effect";

import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";
import { EditorSourceFileSchema } from "~/engine/editor/schema/EditorSourceFileSchema";
import type { ResourceConfigSchema } from "~/engine/resource/schema/ResourceConfigSchema";
import type { ResourceSchema } from "~/engine/pack/schema/ResourceSchema";

const portableResourceIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;
const windowsDeviceNamePattern = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i;

/** Rejects IDs that cannot round-trip through the filename-backed resource source format. */
export const validateResourceEditorSourceIdFx = Effect.fn("validateResourceEditorSourceIdFx")(
	function* (resourceId: string) {
		if (
			!portableResourceIdPattern.test(resourceId) ||
			windowsDeviceNamePattern.test(resourceId)
		) {
			return yield* Effect.fail(
				new EditorProjectError({
					reason: "unsafe-resource-id",
					message: `Resource ${resourceId} cannot be represented by the filename-based source format.`,
				}),
			);
		}
		return resourceId;
	},
);

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

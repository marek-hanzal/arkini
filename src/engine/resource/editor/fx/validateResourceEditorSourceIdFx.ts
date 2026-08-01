import { Effect } from "effect";

import { EditorProjectError } from "~/engine/editor/error/EditorProjectError";

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

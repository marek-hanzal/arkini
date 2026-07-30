import { Effect } from "effect";

import { EditorProjectIdSchema } from "~/engine/editor/schema/EditorProjectIdSchema";

const windowsDeviceNamePattern = /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i;

/** Preserves already-portable game IDs and derives one readable hash-qualified fallback otherwise. */
export const createEditorProjectIdFx = Effect.fn("createEditorProjectIdFx")(
	({ gameId, contentHash }: { readonly gameId: string; readonly contentHash: string }) =>
		Effect.sync(() => {
			const portableGameId = EditorProjectIdSchema.safeParse(gameId);
			if (portableGameId.success) return portableGameId.data;

			const slug = gameId
				.normalize("NFKD")
				.replace(/[\u0300-\u036f]/g, "")
				.replace(/[^A-Za-z0-9._-]+/g, "-")
				.replace(/^[.-]+|[.-]+$/g, "")
				.slice(0, 96)
				.replace(/[.-]+$/g, "");
			const readableSlug =
				slug === "" || !/^[A-Za-z0-9]/.test(slug) ? `project-${slug || "workspace"}` : slug;
			const portableSlug = windowsDeviceNamePattern.test(readableSlug)
				? `project-${readableSlug}`
				: readableSlug;
			return EditorProjectIdSchema.parse(`${portableSlug}-${contentHash.slice(0, 12)}`);
		}),
);

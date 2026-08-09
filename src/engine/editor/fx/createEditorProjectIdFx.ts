import { Effect } from "effect";

import { IdSchema } from "~/engine/common/schema/IdSchema";

/** Preserves safe game IDs and derives one readable hash-qualified fallback otherwise. */
export const createEditorProjectIdFx = Effect.fn("createEditorProjectIdFx")(
	({ gameId, contentHash }: { readonly gameId: string; readonly contentHash: string }) =>
		Effect.sync(() => {
			const portableGameId =
				/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(gameId) &&
				gameId !== "." &&
				gameId !== ".." &&
				!gameId.endsWith(".");
			if (portableGameId) return IdSchema.parse(gameId);

			const slug = gameId
				.normalize("NFKD")
				.replace(/[\u0300-\u036f]/g, "")
				.replace(/[^A-Za-z0-9._-]+/g, "-")
				.replace(/^[.-]+|[.-]+$/g, "")
				.slice(0, 96)
				.replace(/[.-]+$/g, "");
			const readableSlug =
				slug === "" || !/^[A-Za-z0-9]/.test(slug) ? `project-${slug || "workspace"}` : slug;
			return IdSchema.parse(`${readableSlug}-${contentHash.slice(0, 12)}`);
		}),
);

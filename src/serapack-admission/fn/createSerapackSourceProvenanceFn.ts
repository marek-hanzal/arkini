import type { GameSourceProvenanceSchema } from "~/game-config-source/schema/GameSourceProvenanceSchema";

/** Projects one Serapack config into the canonical source identity used by semantic validation. */
export const createSerapackSourceProvenanceFn = (
	gameId: string,
	items: Readonly<Record<string, unknown>>,
): GameSourceProvenanceSchema.Type => {
	const source = `serapack:${gameId}`;
	return {
		meta: source,
		resources: source,
		templates: source,
		start: source,
		items: Object.fromEntries(
			Object.keys(items).map((id) => [
				id,
				source,
			]),
		),
	};
};

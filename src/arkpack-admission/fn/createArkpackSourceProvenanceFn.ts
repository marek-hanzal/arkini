import type { GameSourceProvenanceSchema } from "~/game-config-source/schema/GameSourceProvenanceSchema";

/** Projects one Arkpack config into the canonical source identity used by semantic validation. */
export const createArkpackSourceProvenanceFn = (
	gameId: string,
	items: Readonly<Record<string, unknown>>,
): GameSourceProvenanceSchema.Type => {
	const source = `arkpack:${gameId}`;
	return {
		meta: source,
		resources: source,
		start: source,
		items: Object.fromEntries(
			Object.keys(items).map((id) => [
				id,
				source,
			]),
		),
	};
};

import { readArkiniGameSources } from "./readArkiniGameSources";

/**
 * Reads and merges the current fragmented Arkini authoring sources into one root config value.
 */
export const readArkiniGameConfigSource = () => {
	const sources = readArkiniGameSources();
	const root = sources.find(({ path }) => path.endsWith("/game.json"));
	const items = sources.reduce<Record<string, unknown>>((result, source) => {
		const value = source.value as {
			readonly items?: Record<string, unknown>;
		};

		return {
			...result,
			...value.items,
		};
	}, {});

	return {
		root,
		value: {
			...(root?.value as object),
			items,
		},
	};
};

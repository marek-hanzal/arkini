export const gameEngineQueryRootKey = [
	"game-engine",
] as const;

/** Returns the exact cache identity of one route-owned Game session. */
export const gameEngineQueryKey = (packageId: string) =>
	[
		...gameEngineQueryRootKey,
		packageId,
	] as const;

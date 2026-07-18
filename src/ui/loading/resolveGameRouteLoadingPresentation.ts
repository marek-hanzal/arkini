export interface GameRouteLoadingPresentation {
	readonly key: string;
	readonly label: string;
}

/** Selects only route lifecycle operations that deserve the deliberate root loader. */
export const resolveGameRouteLoadingPresentation = ({
	desiredPackageId,
	ownsGame,
	pathname,
}: {
	readonly desiredPackageId: string | null;
	readonly ownsGame: boolean;
	readonly pathname: string;
}): GameRouteLoadingPresentation | false => {
	if (desiredPackageId !== null) {
		return {
			key: `game-route:${desiredPackageId}`,
			label: "Loading game…",
		};
	}
	if (pathname === "/main-menu" && ownsGame) {
		return {
			key: "game-route:main-menu",
			label: "Returning to main menu…",
		};
	}
	return false;
};

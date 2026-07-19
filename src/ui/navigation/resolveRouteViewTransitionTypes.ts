const mainPagePathnames = new Set([
	"/about",
	"/arkpacks",
	"/main-menu",
	"/settings",
]);

const isGamePathname = (pathname: string) => pathname.startsWith("/game/");

/** Selects the deliberate native route transition family for one location change. */
export const resolveRouteViewTransitionTypes = ({
	fromLocation,
	toLocation,
}: {
	readonly fromLocation?: {
		readonly pathname: string;
	};
	readonly toLocation: {
		readonly pathname: string;
	};
}) => {
	if (fromLocation === undefined) return false;
	const fromPathname = fromLocation.pathname;
	const toPathname = toLocation.pathname;
	const fromMainPage = mainPagePathnames.has(fromPathname);
	const toMainPage = mainPagePathnames.has(toPathname);
	const involvesArkpacks = fromPathname === "/arkpacks" || toPathname === "/arkpacks";

	if (fromMainPage && toMainPage)
		return [
			"main-page",
			...(involvesArkpacks
				? [
						"main-page-arkpacks",
					]
				: []),
		];
	if (
		(fromMainPage && isGamePathname(toPathname)) ||
		(isGamePathname(fromPathname) && toMainPage)
	) {
		return [
			"main-page-game",
		];
	}
	return false;
};

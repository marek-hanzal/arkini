const mainPagePathnames = new Set([
	"/about",
	"/arkpacks",
	"/main-menu",
	"/settings",
]);

const isGamePathname = (pathname: string) => pathname.startsWith("/game/");
const isActionPathname = (pathname: string) => pathname.startsWith("/action/");
const isGameFlowPathname = (pathname: string) =>
	isGamePathname(pathname) || isActionPathname(pathname);

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

	if (fromPathname === "/" && toMainPage) {
		return [
			"startup-main-page",
		];
	}
	if (fromMainPage && toMainPage)
		return [
			"main-page",
			...(involvesArkpacks
				? [
						"main-page-arkpacks",
					]
				: []),
		];
	const fromGameFlow = isGameFlowPathname(fromPathname);
	const toGameFlow = isGameFlowPathname(toPathname);
	if (
		(fromMainPage && toGameFlow) ||
		(fromGameFlow && toMainPage) ||
		(fromGameFlow && toGameFlow)
	) {
		return [
			"main-page-game",
		];
	}
	return false;
};

const launcherPathnames = new Set([
	"/about",
	"/arkpacks",
	"/main-menu",
	"/settings",
]);

type VisualRouteKind = "action" | "board" | "launcher" | "startup";

const gameBoardPattern = /^\/game\/[^/]+\/board\/?$/;
const gameActionPattern = /^\/game\/[^/]+\/action\/[^/]+\/?$/;

const resolveVisualRouteKind = (pathname: string): VisualRouteKind => {
	if (pathname === "/") return "startup";
	if (launcherPathnames.has(pathname)) return "launcher";
	if (gameBoardPattern.test(pathname)) return "board";
	if (pathname.startsWith("/action/") || gameActionPattern.test(pathname)) return "action";
	throw new Error(`Missing View Transition classification for route: ${pathname}`);
};

/** Selects one exhaustive typed native transition for every visible Arkini route pair. */
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
	if (fromLocation === undefined || fromLocation.pathname === toLocation.pathname) return false;
	const fromKind = resolveVisualRouteKind(fromLocation.pathname);
	const toKind = resolveVisualRouteKind(toLocation.pathname);
	return [
		"arkini-route",
		`${fromKind}-to-${toKind}`,
	];
};

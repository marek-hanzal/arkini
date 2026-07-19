type VisualRouteId =
	| "about"
	| "action"
	| "arkpacks"
	| "board"
	| "main-menu"
	| "settings"
	| "startup";

const gameBoardPattern = /^\/game\/[^/]+\/board\/?$/;
const gameActionPattern = /^\/game\/[^/]+\/action\/[^/]+\/?$/;

const resolveVisualRouteId = (pathname: string): VisualRouteId => {
	if (pathname === "/") return "startup";
	if (pathname === "/main-menu") return "main-menu";
	if (pathname === "/settings") return "settings";
	if (pathname === "/about") return "about";
	if (pathname === "/arkpacks") return "arkpacks";
	if (gameBoardPattern.test(pathname)) return "board";
	if (pathname.startsWith("/action/") || gameActionPattern.test(pathname)) return "action";
	throw new Error(`Missing View Transition classification for route: ${pathname}`);
};

const isHeroRoute = (route: VisualRouteId) => route !== "board";

/** Selects one explicit pair plus one broad scene relationship for every visible route change. */
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
	const from = resolveVisualRouteId(fromLocation.pathname);
	const to = resolveVisualRouteId(toLocation.pathname);
	const sceneRelationship = isHeroRoute(from)
		? isHeroRoute(to)
			? "hero-to-hero"
			: "hero-to-board"
		: isHeroRoute(to)
			? "board-to-hero"
			: "board-to-board";
	const pair = `${from}-to-${to}`;
	return pair === sceneRelationship
		? [
				"arkini-route",
				sceneRelationship,
			]
		: [
				"arkini-route",
				sceneRelationship,
				pair,
			];
};

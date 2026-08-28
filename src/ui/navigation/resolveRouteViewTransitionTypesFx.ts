import { Effect } from "effect";
import { match } from "ts-pattern";

type VisualRouteId =
	| "about"
	| "action"
	| "arkpacks"
	| "board"
	| "cheats"
	| "editor"
	| "editor-welcome"
	| "inventory"
	| "main-menu"
	| "settings"
	| "startup";

const gameBoardPattern = /^\/game\/[^/]+\/board\/?$/;
const gameActionPattern = /^\/game\/[^/]+\/action\/[^/]+\/?$/;
const gameCheatsPattern = /^\/game\/[^/]+\/cheats\/?$/;
const gameInventoryPattern = /^\/game\/[^/]+\/inventory\/?$/;
const editorWelcomePattern = /^\/editor(?:\/welcome)?\/?$/;
const editorProjectPattern = /^\/editor\/(?!welcome(?:\/|$))[^/]+(?:\/.*)?$/;
const editorBoardPattern = /^\/editor\/[^/]+\/board\/?$/;
const editorBoardInventoryPattern = /^\/editor\/[^/]+\/board\/inventory\/?$/;

const isEditorBoardLeafTransition = (from: string, to: string) =>
	(editorBoardPattern.test(from) && editorBoardInventoryPattern.test(to)) ||
	(editorBoardInventoryPattern.test(from) && editorBoardPattern.test(to));

const resolveVisualRouteId = (pathname: string): VisualRouteId => {
	if (pathname === "/") return "startup";
	if (pathname === "/main-menu") return "main-menu";
	if (pathname === "/settings") return "settings";
	if (pathname === "/about") return "about";
	if (pathname === "/arkpacks") return "arkpacks";
	if (editorWelcomePattern.test(pathname)) return "editor-welcome";
	if (editorProjectPattern.test(pathname)) return "editor";
	if (gameBoardPattern.test(pathname)) return "board";
	if (gameCheatsPattern.test(pathname)) return "cheats";
	if (gameInventoryPattern.test(pathname)) return "inventory";
	if (pathname.startsWith("/action/") || gameActionPattern.test(pathname)) return "action";
	throw new Error(`Missing View Transition classification for route: ${pathname}`);
};

const isHeroRoute = (route: VisualRouteId) =>
	route !== "board" && route !== "cheats" && route !== "editor" && route !== "inventory";

/** Selects one explicit pair plus one broad scene relationship for every visible route change. */
export const resolveRouteViewTransitionTypesFx = Effect.fn("resolveRouteViewTransitionTypesFx")(
	({
		fromLocation,
		toLocation,
	}: {
		readonly fromLocation?: {
			readonly pathname: string;
		};
		readonly toLocation: {
			readonly pathname: string;
		};
	}) =>
		Effect.sync(() => {
			if (fromLocation === undefined || fromLocation.pathname === toLocation.pathname)
				return false;
			const from = resolveVisualRouteId(fromLocation.pathname);
			const to = resolveVisualRouteId(toLocation.pathname);
			const sceneRelationship = match({
				fromHero: isHeroRoute(from),
				toHero: isHeroRoute(to),
			})
				.with(
					{
						fromHero: true,
						toHero: true,
					},
					() => "hero-to-hero" as const,
				)
				.with(
					{
						fromHero: true,
						toHero: false,
					},
					() => "hero-to-board" as const,
				)
				.with(
					{
						fromHero: false,
						toHero: true,
					},
					() => "board-to-hero" as const,
				)
				.with(
					{
						fromHero: false,
						toHero: false,
					},
					() => "board-to-board" as const,
				)
				.exhaustive();
			const pair = `${from}-to-${to}`;
			const types =
				pair === sceneRelationship
					? [
							"arkini-route",
							sceneRelationship,
						]
					: [
							"arkini-route",
							sceneRelationship,
							pair,
						];
			return isEditorBoardLeafTransition(fromLocation.pathname, toLocation.pathname)
				? [
						...types,
						"editor-board-leaf",
					]
				: types;
		}),
);

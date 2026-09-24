import { Effect } from "effect";
import { match } from "ts-pattern";

type VisualRouteId =
	| "about"
	| "action"
	| "serapacks"
	| "board"
	| "cheats"
	| "editor"
	| "main-menu"
	| "settings"
	| "startup";

const gameBoardPattern = /^\/game\/[^/]+\/board\/?$/;
const gameActionPattern = /^\/game\/[^/]+\/action\/[^/]+\/?$/;
const gameCheatsPattern = /^\/game\/[^/]+\/cheats\/?$/;
const editorProjectPattern = /^\/editor\/[^/]+(?:\/.*)?$/;
const editorArtworkDetailLeafPattern =
	/^\/editor\/([^/]+)\/artwork\/([^/]+)\/detail\/(?:overview|usage|notes|delete)\/?$/;
const settingsPattern = /^\/settings(?:\/(?:common|game|sound|dev))?\/?$/;

const isSameEditorArtworkDetailTransitionFn = (from: string, to: string) => {
	const fromDetail = editorArtworkDetailLeafPattern.exec(from);
	const toDetail = editorArtworkDetailLeafPattern.exec(to);
	return (
		fromDetail !== null &&
		toDetail !== null &&
		fromDetail[1] === toDetail[1] &&
		fromDetail[2] === toDetail[2]
	);
};

const resolveVisualRouteIdFn = (pathname: string): VisualRouteId =>
	match(pathname)
		.with("/", () => "startup" as const)
		.with("/main-menu", () => "main-menu" as const)
		.when(
			(pathname) => settingsPattern.test(pathname),
			() => "settings" as const,
		)
		.with("/about", () => "about" as const)
		.with("/serapacks", "/editor", "/editor/", () => "serapacks" as const)
		.when(
			(pathname) => editorProjectPattern.test(pathname),
			() => "editor" as const,
		)
		.when(
			(pathname) => gameBoardPattern.test(pathname),
			() => "board" as const,
		)
		.when(
			(pathname) => gameCheatsPattern.test(pathname),
			() => "cheats" as const,
		)
		.when(
			(pathname) => pathname.startsWith("/action/") || gameActionPattern.test(pathname),
			() => "action" as const,
		)
		.otherwise(() => {
			throw new Error(`Missing View Transition classification for route: ${pathname}`);
		});

const isHeroRouteFn = (route: VisualRouteId) =>
	route !== "board" && route !== "cheats" && route !== "editor";

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
			if (isSameEditorArtworkDetailTransitionFn(fromLocation.pathname, toLocation.pathname))
				return false;
			const from = resolveVisualRouteIdFn(fromLocation.pathname);
			const to = resolveVisualRouteIdFn(toLocation.pathname);
			const sceneRelationship = match({
				fromHero: isHeroRouteFn(from),
				toHero: isHeroRouteFn(to),
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
							"serakki-route",
							sceneRelationship,
						]
					: [
							"serakki-route",
							sceneRelationship,
							pair,
						];
			return types;
		}),
);

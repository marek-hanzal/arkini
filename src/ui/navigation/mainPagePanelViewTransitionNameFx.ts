import { Effect } from "effect";

export type MainPageTransitionPage =
	| "about"
	| "arkpacks"
	| "editor-welcome"
	| "main-menu"
	| "settings";

const names = {
	about: "arkini-panel-about",
	arkpacks: "arkini-panel-arkpacks",
	"editor-welcome": "arkini-panel-editor-welcome",
	"main-menu": "arkini-panel-main-menu",
	settings: "arkini-panel-settings",
} as const satisfies Record<MainPageTransitionPage, string>;

/** Gives every launcher page its own panel snapshot so unrelated cards never morph together. */
export const mainPagePanelViewTransitionNameFx = Effect.fn("mainPagePanelViewTransitionNameFx")(
	(page: MainPageTransitionPage) => Effect.succeed(names[page]),
);

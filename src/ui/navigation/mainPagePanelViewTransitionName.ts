export type MainPageTransitionPage = "about" | "arkpacks" | "main-menu" | "settings";

const names = {
	about: "arkini-panel-about",
	arkpacks: "arkini-panel-arkpacks",
	"main-menu": "arkini-panel-main-menu",
	settings: "arkini-panel-settings",
} as const satisfies Record<MainPageTransitionPage, string>;

/** Gives every launcher page its own panel snapshot so unrelated cards never morph together. */
export const mainPagePanelViewTransitionName = (page: MainPageTransitionPage) => names[page];

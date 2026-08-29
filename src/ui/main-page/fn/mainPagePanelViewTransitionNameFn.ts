const names = {
	about: "arkini-panel-about",
	arkpacks: "arkini-panel-arkpacks",
	"editor-welcome": "arkini-panel-editor-welcome",
	"main-menu": "arkini-panel-main-menu",
	settings: "arkini-panel-settings",
} as const;

type MainPageTransitionPage = keyof typeof names;

/** Gives every launcher page its own panel snapshot so unrelated cards never morph together. */
export const mainPagePanelViewTransitionNameFn = (page: MainPageTransitionPage) => names[page];

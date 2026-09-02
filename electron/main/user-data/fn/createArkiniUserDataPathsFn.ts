import { join } from "node:path";

import type { ArkiniUserDataPaths } from "../ArkiniUserDataPaths";

/** Resolves every Arkini-owned user-data namespace from Electron's platform root. */
export const createArkiniUserDataPathsFn = (userDataPath: string): ArkiniUserDataPaths => {
	const root = join(userDataPath, "arkini");
	const gameRoot = join(root, "game");
	const editorRoot = join(root, "editor");
	return {
		root,
		diagnostics: join(root, "diagnostics"),
		game: {
			root: gameRoot,
			arkpacks: join(gameRoot, "arkpacks"),
			incidents: join(gameRoot, "incidents"),
			preferences: join(gameRoot, "preferences"),
			saves: join(gameRoot, "saves"),
		},
		editor: {
			root: editorRoot,
			catalog: join(editorRoot, "projects.json"),
			projects: join(editorRoot, "projects"),
		},
	};
};

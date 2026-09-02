import { join } from "node:path";

/** Canonical filesystem roots owned by one Arkini installation for one system user. */
export interface ArkiniUserDataPaths {
	readonly root: string;
	readonly diagnostics: string;
	readonly game: {
		readonly root: string;
		readonly arkpacks: string;
		readonly incidents: string;
		readonly preferences: string;
		readonly saves: string;
	};
	readonly editor: {
		readonly root: string;
		readonly catalog: string;
		readonly projects: string;
	};
}

/** Resolves every Arkini-owned namespace directly below one system home directory. */
export const createArkiniUserDataPathsFn = (homePath: string): ArkiniUserDataPaths => {
	const root = join(homePath, ".arkini");
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

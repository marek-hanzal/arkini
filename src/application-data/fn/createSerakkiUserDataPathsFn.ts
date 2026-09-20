import { join } from "node:path";

/** Canonical filesystem roots owned by one Serakki installation for one system user. */
export interface SerakkiUserDataPaths {
	readonly root: string;
	readonly diagnostics: string;
	readonly game: {
		readonly root: string;
		readonly serapacks: string;
		readonly installations: string;
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

/** Resolves every Serakki-owned namespace directly below one system home directory. */
export const createSerakkiUserDataPathsFn = (homePath: string): SerakkiUserDataPaths => {
	const root = join(homePath, ".serakki");
	const gameRoot = join(root, "game");
	const editorRoot = join(root, "editor");
	return {
		root,
		diagnostics: join(root, "diagnostics"),
		game: {
			root: gameRoot,
			serapacks: join(gameRoot, "serapacks"),
			installations: join(gameRoot, "installed"),
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

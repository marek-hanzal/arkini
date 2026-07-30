import { Effect } from "effect";
import { join } from "node:path";

import type { ArkiniUserDataPaths } from "./ArkiniUserDataPaths";

/** Resolves every Arkini-owned user-data namespace from Electron's platform root. */
export const createArkiniUserDataPathsFx = Effect.fn("createArkiniUserDataPathsFx")(
	(userDataPath: string) =>
		Effect.sync((): ArkiniUserDataPaths => {
			const root = join(userDataPath, "arkini");
			const gameRoot = join(root, "game");
			return {
				root,
				game: {
					root: gameRoot,
					arkpacks: join(gameRoot, "arkpacks"),
					logs: join(gameRoot, "logs"),
					preferences: join(gameRoot, "preferences"),
					saves: join(gameRoot, "saves"),
				},
				editor: join(root, "editor"),
			};
		}),
);

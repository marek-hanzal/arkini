import { Effect, Path } from "effect";

import {
	GameProjectManifestFileName,
	GameProjectSchemaFileName,
} from "~/game-config-source/constant/GameProjectReference";
import { encodeGameProjectFileStemFn } from "~/game-config-source/fn/encodeGameProjectFileStemFn";
import type { ProjectPaths } from "./ProjectPaths";

/** Resolves every fixed and identity-derived path below one Editor project root. */
export const createProjectPathsFx = Effect.fn("createProjectPathsFx")(function* (
	projectRoot: string,
) {
	const path = yield* Path.Path;
	const root = path.resolve(projectRoot);
	const items = path.join(root, "items");
	const assets = path.join(root, "assets");
	const resources = path.join(root, "resources");
	const notes = path.join(root, "notes");

	const readResourceFileFx = Effect.fn("ProjectPaths.readResourceFileFx")(function* (
		directory: string,
		resourceId: string,
	) {
		if (
			path.basename(resourceId) !== resourceId ||
			resourceId.includes("\\") ||
			resourceId.includes("\0") ||
			resourceId === "." ||
			resourceId === ".."
		) {
			return yield* Effect.fail(
				new Error(
					`Resource ${JSON.stringify(resourceId)} cannot be represented by a PNG filename.`,
				),
			);
		}
		return path.join(directory, `${resourceId}.png`);
	});

	return {
		root,
		build: path.join(root, "build"),
		gitignoreFile: path.join(root, ".gitignore"),
		projectFile: path.join(root, GameProjectManifestFileName),
		lockFile: path.join(root, "editor.lock"),
		schemaFile: path.join(root, GameProjectSchemaFileName),
		gameFile: path.join(root, "game.json"),
		items,
		assets,
		resources,
		notes,
		itemFileFx: ({ uid }) =>
			Effect.succeed(path.join(items, `${encodeGameProjectFileStemFn(uid)}.json`)),
		assetFileFx: (resourceId) => readResourceFileFx(assets, resourceId),
		resourceFileFx: (resourceId) => readResourceFileFx(resources, resourceId),
		noteFileFx: (noteId) =>
			Effect.succeed(path.join(notes, `${encodeGameProjectFileStemFn(noteId)}.json`)),
	} satisfies ProjectPaths;
});

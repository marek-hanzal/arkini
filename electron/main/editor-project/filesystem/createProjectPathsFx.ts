import { createHash } from "node:crypto";
import { Effect, Path } from "effect";

import {
	GameProjectManifestFileName,
	GameProjectSchemaFileName,
} from "~/engine/source/GameProjectReference";
import type { ProjectPaths } from "./ProjectPaths";

const encodeFileStem = (value: string) => encodeURIComponent(value).replaceAll(".", "%2E");

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
	const scenarios = path.join(root, "scenarios");
	const versions = path.join(root, "versions");
	const objects = path.join(root, "objects");

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
		scenarios,
		versions,
		versionHeadFile: path.join(versions, "head.json"),
		objects,
		itemFileFx: ({ type, uid }) =>
			Effect.succeed(path.join(items, type, `${encodeFileStem(uid)}.json`)),
		assetFileFx: (resourceId) => readResourceFileFx(assets, resourceId),
		resourceFileFx: (resourceId) => readResourceFileFx(resources, resourceId),
		noteFileFx: (noteId) => Effect.succeed(path.join(notes, `${encodeFileStem(noteId)}.json`)),
		scenarioFileFx: (name) =>
			Effect.succeed(
				path.join(scenarios, `${createHash("sha256").update(name).digest("hex")}.json`),
			),
		versionDirectoryFx: (versionId) =>
			Effect.succeed(path.join(versions, encodeFileStem(versionId))),
		versionDescriptorFileFx: (versionId) =>
			Effect.succeed(path.join(versions, encodeFileStem(versionId), "version.json")),
		versionManifestFileFx: (versionId) =>
			Effect.succeed(path.join(versions, encodeFileStem(versionId), "manifest.json")),
		jsonObjectFileFx: (hash) => Effect.succeed(path.join(objects, `${hash}.json`)),
		pngObjectFileFx: (hash) => Effect.succeed(path.join(objects, `${hash}.png`)),
	} satisfies ProjectPaths;
});

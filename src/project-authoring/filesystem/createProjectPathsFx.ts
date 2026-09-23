import { Effect, Path } from "effect";

import {
	GameProjectManifestFileName,
	GameProjectSchemaFileName,
} from "~/game-config-source/constant/GameProjectReference";
import { encodeGameProjectFileStemFn } from "~/game-config-source/fn/encodeGameProjectFileStemFn";
import type { ProjectPaths } from "./ProjectPaths";
import type { ResourceTypeSchema } from "~/game-config-resource/schema/ResourceTypeSchema";

/** Resolves every fixed and identity-derived path below one Editor project root. */
export const createProjectPathsFx = Effect.fn("createProjectPathsFx")(function* (
	projectRoot: string,
) {
	const path = yield* Path.Path;
	const root = path.resolve(projectRoot);
	const items = path.join(root, "items");
	const artwork = path.join(root, "artwork");
	const image = path.join(root, "image");
	const music = path.join(root, "music");
	const sfx = path.join(root, "sfx");
	const notes = path.join(root, "notes");

	const readResourceFileFx = Effect.fn("ProjectPaths.readResourceFileFx")(function* (
		directory: string,
		resourceUid: string,
		extension: ".ogg" | ".png" | ".json",
	) {
		if (
			path.basename(resourceUid) !== resourceUid ||
			resourceUid.includes("\\") ||
			resourceUid.includes("\0") ||
			resourceUid === "." ||
			resourceUid === ".."
		) {
			return yield* Effect.fail(
				new Error(
					`Resource ${JSON.stringify(resourceUid)} cannot be represented by a source filename.`,
				),
			);
		}
		return path.join(directory, `${resourceUid}${extension}`);
	});
	const resourceFileFx = ({
		uid,
		type,
	}: {
		readonly uid: string;
		readonly type: ResourceTypeSchema.Type;
	}) =>
		type === "artwork"
			? readResourceFileFx(artwork, uid, ".png")
			: type === "image"
				? readResourceFileFx(image, uid, ".png")
				: type === "music"
					? readResourceFileFx(music, uid, ".ogg")
					: readResourceFileFx(sfx, uid, ".ogg");

	return {
		root,
		build: path.join(root, "build"),
		gitignoreFile: path.join(root, ".gitignore"),
		projectFile: path.join(root, GameProjectManifestFileName),
		lockFile: path.join(root, "editor.lock"),
		schemaFile: path.join(root, GameProjectSchemaFileName),
		gameFile: path.join(root, "game.json"),
		items,
		artwork,
		image,
		notes,
		itemFileFx: ({ uid }) =>
			Effect.succeed(path.join(items, `${encodeGameProjectFileStemFn(uid)}.json`)),
		artworkFileFx: (resourceUid) => readResourceFileFx(artwork, resourceUid, ".png"),
		imageFileFx: (resourceUid) => readResourceFileFx(image, resourceUid, ".png"),
		resourceFileFx,
		resourceMetadataFileFx: ({ uid, type }) =>
			readResourceFileFx(
				type === "artwork"
					? artwork
					: type === "image"
						? image
						: type === "music"
							? music
							: sfx,
				uid,
				".json",
			),
		noteFileFx: (noteId) =>
			Effect.succeed(path.join(notes, `${encodeGameProjectFileStemFn(noteId)}.json`)),
	} satisfies ProjectPaths;
});

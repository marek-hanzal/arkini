import { decodeGameProjectFileStemFn } from "~/game-config-source/fn/decodeGameProjectFileStemFn";
import { TilePaintingFileSchema } from "~/tile-painting/schema/TilePaintingFileSchema";
import { validateTilePaintingDocumentFx } from "./validateTilePaintingDocumentFx";
import { Effect, FileSystem, Path } from "effect";
import type { ProjectPaths } from "../ProjectPaths";

/** Captures portable painting recipes only at explicit project open/Refresh. */
export const readProjectTilePaintingsFx = Effect.fn("readProjectTilePaintingsFx")(function* ({
	paths,
	projectId,
}: {
	readonly paths: ProjectPaths;
	readonly projectId: string;
}) {
	const fs = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	if (!(yield* fs.exists(paths.tilePaintings))) return [];
	const canonicalRoot = yield* fs.realPath(paths.root);
	const files = (yield* fs.readDirectory(paths.tilePaintings))
		.filter((file) => file.endsWith(".json"))
		.sort();
	if (files.length > 256)
		return yield* Effect.fail(new Error("A project supports at most 256 paintings."));
	return yield* Effect.forEach(files, (file) =>
		Effect.gen(function* () {
			const target = path.join(paths.tilePaintings, file);
			const resolved = yield* fs.realPath(target);
			if (path.relative(canonicalRoot, resolved) !== path.relative(paths.root, target))
				return yield* Effect.fail(
					new Error(`Painting ${file} must not redirect outside its canonical path.`),
				);
			const info = yield* fs.stat(target);
			if (info.type !== "File" || Number(info.size) > 65 * 1024 * 1024)
				return yield* Effect.fail(new Error(`Painting ${file} is not a bounded document.`));
			const paintingId = decodeGameProjectFileStemFn(file.slice(0, -".json".length));
			if (paintingId === undefined || paintingId.length === 0)
				return yield* Effect.fail(new Error(`Painting ${file} has an invalid filename.`));
			const source = yield* fs.readFileString(target);
			const painting = yield* Effect.try({
				try: () => TilePaintingFileSchema.parse(JSON.parse(source)),
				catch: (cause) =>
					new Error(`Painting ${file} is invalid.`, {
						cause,
					}),
			});
			if ((yield* paths.tilePaintingFileFx(paintingId)) !== target)
				return yield* Effect.fail(new Error(`Painting ${file} has an invalid identity.`));
			yield* validateTilePaintingDocumentFx(painting.document);
			return {
				...painting,
				paintingId,
				projectId,
			};
		}),
	);
});

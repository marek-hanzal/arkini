import { FileSystem, Path } from "effect";
import { Effect } from "effect";

import { EditorProjectCatalogEntrySchema } from "~/editor/filesystem/EditorProjectCatalogEntrySchema";
import { EditorProjectCatalogSchema } from "~/editor/filesystem/EditorProjectCatalogSchema";
import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import { replaceFilesystemEditorJsonFx } from "./replaceFilesystemEditorJsonFx";

type Entry = EditorProjectCatalogEntrySchema.Type;

export interface FilesystemEditorProjectCatalog {
	readonly addFx: (entry: Entry) => Effect.Effect<void, EditorProjectRepositoryError>;
	readonly list: () => ReadonlyArray<Entry>;
	readonly removeFx: (root: string) => Effect.Effect<void, EditorProjectRepositoryError>;
}

const createError = (message: string, cause?: unknown) =>
	new EditorProjectRepositoryError({
		operation: "list-projects",
		message,
		cause,
	});

const parseCatalog = (candidate: unknown) => {
	if (
		typeof candidate !== "object" ||
		candidate === null ||
		!("formatVersion" in candidate) ||
		candidate.formatVersion !== 1 ||
		!("projects" in candidate) ||
		!Array.isArray(candidate.projects)
	)
		throw new Error("The Editor project catalog envelope is invalid.");
	const roots = new Set<string>();
	const projects: Array<Entry> = [];
	for (const value of candidate.projects) {
		const parsed = EditorProjectCatalogEntrySchema.safeParse(value);
		if (!parsed.success || roots.has(parsed.data.root)) continue;
		roots.add(parsed.data.root);
		projects.push(parsed.data);
	}
	return EditorProjectCatalogSchema.parse({
		formatVersion: 1,
		projects,
	});
};

/** Opens the one main-owned path registry; project contents always remain authoritative. */
export const createFilesystemEditorProjectCatalogFx = Effect.fn(
	"createFilesystemEditorProjectCatalogFx",
)(function* ({ catalogPath }: { readonly catalogPath: string }) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const replaceJsonFx = (target: string, value: unknown) =>
		replaceFilesystemEditorJsonFx(target, value).pipe(
			Effect.provideService(FileSystem.FileSystem, fileSystem),
			Effect.provideService(Path.Path, path),
		);
	yield* fileSystem.makeDirectory(path.dirname(catalogPath), {
		recursive: true,
	});
	let catalog = yield* fileSystem.exists(catalogPath).pipe(
		Effect.flatMap((exists) =>
			exists
				? fileSystem.readFileString(catalogPath).pipe(
						Effect.flatMap((source) =>
							Effect.try({
								try: () => parseCatalog(JSON.parse(source)),
								catch: (cause) =>
									createError("The Editor project catalog is invalid.", cause),
							}),
						),
					)
				: Effect.succeed(
						EditorProjectCatalogSchema.parse({
							formatVersion: 1,
							projects: [],
						}),
					),
		),
		Effect.mapError((cause) =>
			cause instanceof EditorProjectRepositoryError
				? cause
				: createError("The Editor project catalog could not be opened.", cause),
		),
	);
	if (!(yield* fileSystem.exists(catalogPath))) yield* replaceJsonFx(catalogPath, catalog);

	const writeFx = (projects: ReadonlyArray<Entry>) =>
		Effect.gen(function* () {
			const next = EditorProjectCatalogSchema.parse({
				formatVersion: 1,
				projects,
			});
			yield* replaceJsonFx(catalogPath, next);
			catalog = next;
		}).pipe(
			Effect.mapError((cause) =>
				createError("The Editor project catalog could not be saved.", cause),
			),
		);

	return {
		addFx: (entry) => {
			const projects = catalog.projects.filter((candidate) => candidate.root !== entry.root);
			return writeFx([
				...projects,
				entry,
			]);
		},
		list: () => catalog.projects,
		removeFx: (root) => writeFx(catalog.projects.filter((entry) => entry.root !== root)),
	} satisfies FilesystemEditorProjectCatalog;
});

import { FileSystem, Path } from "effect";
import { Effect } from "effect";

import { EditorProjectCatalogEntrySchema } from "~/editor/filesystem/EditorProjectCatalogEntrySchema";
import { EditorProjectCatalogSchema } from "~/editor/filesystem/EditorProjectCatalogSchema";
import { EditorProjectRepositoryError } from "~/editor/EditorProjectRepositoryError";
import { createFilesystemWriteFx } from "~/engine/filesystem/createFilesystemWriteFx";
import { withFilesystemWriteRecovery } from "~/engine/filesystem/FilesystemWriteError";

const encoder = new TextEncoder();

type Entry = EditorProjectCatalogEntrySchema.Type;

export interface FilesystemEditorProjectCatalog {
	readonly addFx: (entry: Entry) => Effect.Effect<void, EditorProjectRepositoryError>;
	readonly list: () => ReadonlyArray<Entry>;
	readonly removeFx: (root: string) => Effect.Effect<void, EditorProjectRepositoryError>;
}

const createError = (message: string, cause?: unknown) =>
	new EditorProjectRepositoryError({
		operation: "list-projects",
		message: withFilesystemWriteRecovery(message, cause),
		cause,
	});

const parseCatalog = (candidate: unknown) => EditorProjectCatalogSchema.parse(candidate);

/** Opens the one main-owned path registry; project contents always remain authoritative. */
export const createFilesystemEditorProjectCatalogFx = Effect.fn(
	"createFilesystemEditorProjectCatalogFx",
)(function* ({ catalogPath }: { readonly catalogPath: string }) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const filesystemWrite = yield* createFilesystemWriteFx();
	const lock = `${catalogPath}.lock`;
	const writeJsonFx = (value: unknown) =>
		filesystemWrite.writeFileFx({
			lock,
			target: catalogPath,
			bytes: encoder.encode(`${JSON.stringify(value, undefined, "\t")}\n`),
		});
	yield* fileSystem.makeDirectory(path.dirname(catalogPath), {
		recursive: true,
	});
	const readFx = Effect.gen(function* () {
		if (yield* fileSystem.exists(catalogPath)) {
			const source = yield* fileSystem.readFileString(catalogPath);
			return yield* Effect.try({
				try: () => parseCatalog(JSON.parse(source)),
				catch: (cause) => createError("The Editor project catalog is invalid.", cause),
			});
		}
		const empty = EditorProjectCatalogSchema.parse({
			projects: [],
		});
		yield* writeJsonFx(empty);
		return empty;
	});
	let catalog = yield* filesystemWrite.withLockFx(lock, readFx);

	const updateFx = (update: (current: ReadonlyArray<Entry>) => ReadonlyArray<Entry>) =>
		filesystemWrite
			.withLockFx(
				lock,
				Effect.gen(function* () {
					const current = yield* readFx;
					const next = EditorProjectCatalogSchema.parse({
						projects: update(current.projects),
					});
					yield* writeJsonFx(next);
					catalog = next;
				}),
			)
			.pipe(
				Effect.mapError((cause) =>
					createError("The Editor project catalog could not be saved.", cause),
				),
			);

	return {
		addFx: (entry) =>
			updateFx((projects) => [
				...projects.filter((candidate) => candidate.root !== entry.root),
				entry,
			]),
		list: () => catalog.projects,
		removeFx: (root) => updateFx((projects) => projects.filter((entry) => entry.root !== root)),
	} satisfies FilesystemEditorProjectCatalog;
});

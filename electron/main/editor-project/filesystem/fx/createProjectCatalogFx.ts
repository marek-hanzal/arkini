import { FileSystem, Path } from "effect";
import { Effect } from "effect";

import { ProjectCatalogEntrySchema } from "~/project-authoring/schema/ProjectCatalogEntrySchema";
import { ProjectCatalogSchema } from "~/project-authoring/schema/ProjectCatalogSchema";
import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import { createFilesystemWriteFx } from "~/filesystem-write/fx/createFilesystemWriteFx";
import { withFilesystemWriteRecoveryFn } from "~/filesystem-write/fn/withFilesystemWriteRecoveryFn";

const encoder = new TextEncoder();

export interface ProjectCatalog {
	readonly addFx: (
		entry: ProjectCatalogEntrySchema.Type,
	) => Effect.Effect<void, ProjectRepositoryError, never>;
	readonly listFn: () => ReadonlyArray<ProjectCatalogEntrySchema.Type>;
	readonly removeFx: (root: string) => Effect.Effect<void, ProjectRepositoryError, never>;
}

const createErrorFn = (message: string, cause?: unknown) =>
	new ProjectRepositoryError({
		operation: "list-projects",
		message: withFilesystemWriteRecoveryFn(message, cause),
		cause,
	});

const parseCatalogFn = (candidate: unknown) => ProjectCatalogSchema.parse(candidate);
const parseStoredCatalogFn = (source: string) => {
	try {
		return parseCatalogFn(JSON.parse(source));
	} catch {
		return null;
	}
};

/** Opens the one main-owned path registry; project contents always remain authoritative. */
export const createProjectCatalogFx = Effect.fn("createProjectCatalogFx")(function* ({
	catalogPath,
	projectsRoot,
}: {
	readonly catalogPath: string;
	readonly projectsRoot: string;
}) {
	const fileSystem = yield* FileSystem.FileSystem;
	const path = yield* Path.Path;
	const filesystemWrite = yield* createFilesystemWriteFx();
	const lock = `${catalogPath}.lock`;
	const writeJsonFx = (value: unknown) =>
		filesystemWrite.replaceFileFx({
			lock,
			target: catalogPath,
			bytes: encoder.encode(`${JSON.stringify(value, undefined, "\t")}\n`),
		});
	yield* fileSystem.makeDirectory(path.dirname(catalogPath), {
		recursive: true,
	});
	yield* fileSystem.makeDirectory(projectsRoot, {
		recursive: true,
	});
	const managedProjectsRoot = yield* fileSystem.realPath(projectsRoot);
	const readReconciledFx = Effect.gen(function* () {
		const stored = yield* Effect.gen(function* () {
			if (!(yield* fileSystem.exists(catalogPath))) return null;
			const source = yield* fileSystem.readFileString(catalogPath);
			return parseStoredCatalogFn(source);
		});
		const previousManaged = new Map(
			(stored?.projects ?? [])
				.filter((entry) => entry.ownership === "managed")
				.map(
					(entry) =>
						[
							entry.root,
							entry.createdAtMs,
						] as const,
				),
		);
		const managed: Array<ProjectCatalogEntrySchema.Type> = [];
		for (const name of (yield* fileSystem.readDirectory(managedProjectsRoot)).sort()) {
			if (name === ".projects.lock") continue;
			const root = path.join(managedProjectsRoot, name);
			if ((yield* fileSystem.stat(root)).type !== "Directory") continue;
			managed.push(
				ProjectCatalogEntrySchema.parse({
					root,
					ownership: "managed",
					createdAtMs: previousManaged.get(root) ?? 0,
				}),
			);
		}
		const managedRoots = new Set(managed.map((entry) => entry.root));
		return ProjectCatalogSchema.parse({
			projects: [
				...managed,
				...(stored?.projects ?? []).filter(
					(entry) => entry.ownership === "external" && !managedRoots.has(entry.root),
				),
			],
		});
	});
	let catalog = yield* filesystemWrite.withLockFx(
		lock,
		readReconciledFx.pipe(Effect.tap(writeJsonFx)),
	);

	const updateFx = (
		updateFn: (
			current: ReadonlyArray<ProjectCatalogEntrySchema.Type>,
		) => ReadonlyArray<ProjectCatalogEntrySchema.Type>,
	) =>
		filesystemWrite
			.withLockFx(
				lock,
				Effect.gen(function* () {
					const current = yield* readReconciledFx;
					const next = ProjectCatalogSchema.parse({
						projects: updateFn(current.projects),
					});
					yield* writeJsonFx(next);
					catalog = next;
				}),
			)
			.pipe(
				Effect.mapError((cause) =>
					createErrorFn("The Editor project catalog could not be saved.", cause),
				),
			);

	return {
		addFx: (entry) =>
			updateFx((projects) => [
				...projects.filter((candidate) => candidate.root !== entry.root),
				entry,
			]),
		listFn: () => catalog.projects,
		removeFx: (root) => updateFx((projects) => projects.filter((entry) => entry.root !== root)),
	} satisfies ProjectCatalog;
});

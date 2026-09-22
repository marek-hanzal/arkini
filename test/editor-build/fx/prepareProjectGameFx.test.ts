import { Effect } from "effect";
import { describe, expect, it, vi } from "vitest";

import { SerakkiAppVersion } from "~shared/SerakkiAppMetadata";
import { prepareProjectGameFx } from "~/editor-build/fx/prepareProjectGameFx";
import { EditorBuildRepository } from "~/editor-build/service/EditorBuildRepository";
import type { EditorBuildRepositoryService } from "~/editor-build/service/EditorBuildRepository";
import type { EditorProjectBuildSchema } from "~/editor-build/schema/EditorProjectBuildSchema";
import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import type { ProjectRepositoryService } from "~/project-authoring/service/ProjectRepository";
import type { Project } from "~/project-authoring/type/Project";
import { createSerapackCatalogFx } from "~/serapack-catalog/fx/createSerapackCatalogFx";
import type { SerapackDescriptor } from "~/serapack-catalog/type/SerapackDescriptor";
import { UnusedEditorProjectRepository } from "~test/support/UnusedEditorProjectRepository";

const project: Project = {
	projectId: "project:build",
	title: "Project",
	version: {
		major: 1,
		minor: 0,
	},
	revision: 7,
	createdAtMs: 1,
	updatedAtMs: 2,
	config: {} as Project["config"],
	resources: [],
};

const artifact: EditorProjectBuildSchema.Type = {
	projectId: project.projectId,
	version: "1.0",
	revision: project.revision,
	contentHash: "b".repeat(64),
	size: 1,
	diagnostics: [],
};

const descriptor = (
	version: string,
	contentHash: string,
	projectRevision = project.revision,
): SerapackDescriptor => ({
	packageId: project.projectId,
	contentHash,
	title: "Installed",
	version,
	serakki: SerakkiAppVersion,
	projectRevision,
	provenance: {
		type: "community",
	},
	source: "user",
});

const setup = async (initial: ReadonlyArray<SerapackDescriptor>) => {
	let installed = initial;
	const install = vi.fn(
		(request: { readonly expectedRevision: number; readonly contentHash: string }) =>
			Effect.sync(() => {
				const published = descriptor(artifact.version, request.contentHash);
				installed = [
					published,
				];
				return published;
			}),
	);
	const catalog = Effect.runSync(
		createSerapackCatalogFx({
			listFx: Effect.sync(() => installed),
			installFx: install,
		}),
	);
	await Effect.runPromise(catalog.refreshFx);
	const readProject = vi.fn(() => Effect.succeed(project));
	const buildProject = vi.fn(() => Effect.succeed(artifact));
	const projects: ProjectRepositoryService = {
		...UnusedEditorProjectRepository,
		awaitIdleFx: Effect.void,
		createProjectFx: () => Effect.die("Unexpected project create."),
		deleteItemFx: () => Effect.die("Unexpected item delete."),
		listProjectsFx: Effect.die("Unexpected project list."),
		readProjectFx: readProject,
		replaceConfigFx: () => Effect.die("Unexpected config replacement."),
		replaceResourceFx: () => Effect.die("Unexpected resource replacement."),
		upsertItemFx: () => Effect.die("Unexpected item upsert."),
	};
	const builds: EditorBuildRepositoryService = {
		saveBuildVersionFx: () => Effect.die("Unexpected version write."),
		buildProjectFx: buildProject,
	};
	const run = () =>
		Effect.runPromise(
			prepareProjectGameFx(project.projectId, catalog).pipe(
				Effect.provideService(ProjectRepository, projects),
				Effect.provideService(EditorBuildRepository, builds),
			),
		);
	return {
		buildProject,
		install,
		readProject,
		run,
	};
};

describe("prepareProjectGameFx", () => {
	it("plays a package with the current project revision without rebuilding", async () => {
		const { buildProject, install, run } = await setup([
			descriptor("1.0", artifact.contentHash),
		]);
		await expect(run()).resolves.toEqual({
			type: "ready",
			packageId: project.projectId,
		});
		expect(buildProject).not.toHaveBeenCalled();
		expect(install).not.toHaveBeenCalled();
	});

	it.each([
		{
			name: "missing",
			initial: [],
		},
		{
			name: "stale revision",
			initial: [
				descriptor("1.0", "a".repeat(64), project.revision - 1),
			],
		},
		{
			name: "stale version",
			initial: [
				descriptor("1.1", "a".repeat(64)),
			],
		},
	])("publishes a $name same-major package before Play", async ({ initial }) => {
		const { buildProject, install, run } = await setup(initial);
		await expect(run()).resolves.toEqual({
			type: "ready",
			packageId: project.projectId,
		});
		expect(buildProject).toHaveBeenCalledOnce();
		expect(install).toHaveBeenCalledOnce();
		expect(install).toHaveBeenCalledWith(
			expect.objectContaining({
				packageId: project.projectId,
				expectedRevision: project.revision,
				contentHash: artifact.contentHash,
			}),
		);
	});

	it("requires a major-update decision before replacing the installed package", async () => {
		const { install, run } = await setup([
			descriptor("2.0", "a".repeat(64)),
		]);
		await expect(run()).resolves.toMatchObject({
			type: "confirmation",
			artifact,
			confirmation: {
				installedVersion: "2.0",
				targetVersion: "1.0",
			},
		});
		expect(install).not.toHaveBeenCalled();
	});
});

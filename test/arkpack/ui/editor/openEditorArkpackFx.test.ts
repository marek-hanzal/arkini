import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadArkpackFx } from "~/arkpack/renderer/loadArkpackFx";
import { openEditorArkpackFx } from "~/arkpack/ui/editor/openEditorArkpackFx";
import type { EditorProject } from "~/editor/EditorProject";
import {
	EditorProjectRepository,
	type EditorProjectRepositoryService,
} from "~/editor/EditorProjectRepository";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import { UnusedEditorProjectRepository } from "~test/support/UnusedEditorProjectRepository";
import { ArkiniAppVersion } from "../../../../shared/ArkiniAppMetadata";

vi.mock("~/arkpack/renderer/loadArkpackFx", () => ({
	loadArkpackFx: vi.fn(),
}));

const project: EditorProject = {
	projectId: editorTestPayload.config.meta.id,
	title: editorTestPayload.config.meta.title,
	version: "4.2",
	createdAtMs: 100,
	updatedAtMs: 100,
	revision: 0,
	config: editorTestPayload.config,
	resources: editorTestPayload.resources,
};

const createRepository = (
	readProjectFx: EditorProjectRepositoryService["readProjectFx"],
	createProjectFx: EditorProjectRepositoryService["createProjectFx"],
): EditorProjectRepositoryService => ({
	...UnusedEditorProjectRepository,
	awaitIdleFx: Effect.void,
	readProjectFx,
	createProjectFx,
	listProjectsFx: Effect.die("Unexpected project list."),
	replaceConfigFx: () => Effect.die("Unexpected config save."),
	replaceResourceFx: () => Effect.die("Unexpected resource replacement."),
	deleteItemFx: () => Effect.die("Unexpected item delete."),
	upsertItemFx: () => Effect.die("Unexpected item save."),
	upsertResourcesFx: () => Effect.die("Unexpected resource save."),
});

const runOpen = (repository: EditorProjectRepositoryService) =>
	Effect.runPromise(
		openEditorArkpackFx(project.projectId).pipe(
			Effect.provideService(EditorProjectRepository, repository),
		),
	);

afterEach(() => {
	vi.clearAllMocks();
});

describe("openEditorArkpackFx", () => {
	it("returns the existing matching Editor project without loading the Arkpack", async () => {
		const result = await runOpen(
			createRepository(
				() => Effect.succeed(project),
				() => Effect.die("Unexpected project creation."),
			),
		);

		expect(result).toBe(project);
		expect(loadArkpackFx).not.toHaveBeenCalled();
	});

	it("creates a missing Editor project from the validated installed payload", async () => {
		vi.mocked(loadArkpackFx).mockReturnValue(
			Effect.succeed({
				descriptor: {
					packageId: project.projectId,
					contentHash: "a".repeat(64),
					title: project.title,
					version: project.version,
					arkini: ArkiniAppVersion,
					provenance: {
						type: "community",
					},
					source: "user",
					overridesBundled: false,
				},
				payload: {
					version: project.version,
					arkini: ArkiniAppVersion,
					config: project.config,
					resources: [
						...project.resources,
					],
				},
			}),
		);
		const createProjectFx = vi.fn(() => Effect.succeed(project));

		const result = await runOpen(createRepository(() => Effect.succeed(null), createProjectFx));

		expect(result).toBe(project);
		expect(loadArkpackFx).toHaveBeenCalledWith({
			packageId: project.projectId,
		});
		expect(createProjectFx).toHaveBeenCalledWith({
			version: project.version,
			config: project.config,
			resources: project.resources,
		});
	});
});

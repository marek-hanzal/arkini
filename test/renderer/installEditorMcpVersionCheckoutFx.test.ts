// @vitest-environment jsdom

import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditorProjectRepositoryService } from "~/bridge/editor/EditorProjectRepository";
import { installEditorMcpVersionCheckoutFx } from "~/bridge/editor/version/installEditorMcpVersionCheckoutFx";
import type { ArkiniRouter } from "~/createArkiniRouterFx";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";
import { createTestRendererRuntime } from "~test/support/createTestRendererRuntime";
import { UnusedEditorProjectRepository } from "~test/support/UnusedEditorProjectRepository";

const project = {
	projectId: "project-one",
	title: editorTestPayload.config.meta.title,
	version: editorTestPayload.version,
	createdAtMs: 1,
	updatedAtMs: 1,
	revision: 0,
	config: editorTestPayload.config,
	resources: editorTestPayload.resources,
};

const version = {
	applicability: {
		type: "applicable" as const,
	},
	arkini: editorTestPayload.game,
	arkpackVersion: project.version,
	createdAtMs: 2,
	projectId: project.projectId,
	snapshotFormatVersion: 1,
	sourceRevision: 0,
	subject: "Snapshot",
	versionId: "version-one",
};

const runtimes: Array<ReturnType<typeof createTestRendererRuntime>["rendererRuntime"]> = [];

afterEach(async () => {
	for (const runtime of runtimes.splice(0)) await runtime.dispose();
});

describe("installEditorMcpVersionCheckoutFx", () => {
	it("uses the renderer checkout coordinator and reloads the exact open project", async () => {
		const checkoutVersionFx = vi.fn(() =>
			Effect.succeed({
				project: {
					...project,
					revision: 1,
				},
				version,
			}),
		);
		const repository: EditorProjectRepositoryService = {
			...UnusedEditorProjectRepository,
			awaitIdleFx: Effect.void,
			checkoutVersionFx,
			createProjectFx: () => Effect.die("Unexpected project create."),
			deleteItemFx: () => Effect.die("Unexpected item delete."),
			listProjectsFx: Effect.die("Unexpected project list."),
			readProjectFx: () => Effect.succeed(project),
			readVersionStatusFx: () =>
				Effect.succeed({
					canCommit: true,
					currentFingerprint: "a".repeat(64),
					dirty: true,
					versionCount: 1,
				}),
			replaceConfigFx: () => Effect.die("Unexpected config write."),
			replaceResourceFx: () => Effect.die("Unexpected resource write."),
			upsertItemFx: () => Effect.die("Unexpected item write."),
			upsertResourcesFx: () => Effect.die("Unexpected resources write."),
		};
		const { rendererRuntime } = createTestRendererRuntime({
			createResourceFx: () => Effect.never,
			editorProjectRepository: repository,
		});
		runtimes.push(rendererRuntime);
		let listener:
			| ((request: { projectId: string; versionId: string }) => Promise<void>)
			| undefined;
		const remove = vi.fn();
		const hardReload = vi.fn();
		const router = {
			state: {
				matches: [
					{
						params: {
							projectId: "project-one",
						},
					},
				],
			},
		} as unknown as Pick<ArkiniRouter, "state">;
		const uninstall = rendererRuntime.runSync(
			installEditorMcpVersionCheckoutFx({
				editorMcp: {
					onVersionCheckoutRequested: (next) => {
						listener = next;
						return remove;
					},
				},
				hardReload,
				rendererRuntime,
				router,
			}),
		);
		if (listener === undefined) throw new Error("Expected checkout listener.");

		await expect(
			listener({
				projectId: "another-project",
				versionId: "version-one",
			}),
		).rejects.toThrow("no longer open");
		await listener({
			projectId: "project-one",
			versionId: "version-one",
		});

		expect(checkoutVersionFx).toHaveBeenCalledWith({
			projectId: "project-one",
			versionId: "version-one",
			expectedFingerprint: "a".repeat(64),
		});
		expect(hardReload).toHaveBeenCalledWith("project-one");
		uninstall();
		expect(remove).toHaveBeenCalledOnce();
	});
});

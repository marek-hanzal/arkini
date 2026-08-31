import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Project } from "~/project-authoring/type/Project";
import { createEditorBoardGameFx } from "~/board-scenario/fx/createEditorBoardGameFx";
import { spawnItemFx } from "~test/support/spawnItemFx";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

const project: Project = {
	projectId: "editor-board",
	title: editorTestPayload.config.meta.title,
	version: editorTestPayload.version,
	createdAtMs: 1,
	updatedAtMs: 1,
	revision: 7,
	config: editorTestPayload.config,
	resources: editorTestPayload.resources,
};

afterEach(() => {
	vi.restoreAllMocks();
});

describe("Board Scenario createEditorBoardGameFx", () => {
	it("owns one fresh revision-pinned game and discards it without package persistence", async () => {
		const createObjectUrl = vi
			.spyOn(URL, "createObjectURL")
			.mockReturnValueOnce("blob:editor-hero")
			.mockReturnValueOnce("blob:editor-water");
		const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL");
		const game = await Effect.runPromise(
			createEditorBoardGameFx({
				project,
			}),
		);

		expect(game.projectId).toBe(project.projectId);
		expect(game.projectRevision).toBe(project.revision);
		expect(game.getSnapshotFn().cheats).toEqual({
			enabled: true,
			everEnabled: true,
			instantGameplay: false,
		});
		expect(game.getSnapshotFn().items).toEqual([
			expect.objectContaining({
				item: expect.objectContaining({
					id: "water",
				}),
			}),
		]);
		expect(game.getResourceUrlFn("item-water")).toBe("blob:editor-water");
		expect(createObjectUrl).toHaveBeenCalledTimes(2);
		expect("arkpack" in game).toBe(false);
		expect("saveKey" in game).toBe(false);

		await game.runFn(
			spawnItemFx({
				id: "runtime:ephemeral",
				itemId: "water",
				location: {
					scope: "inventory",
					position: {
						x: 0,
						y: 0,
					},
				},
				quantity: 1,
			}),
		);
		expect(game.getSnapshotFn().items).toHaveLength(2);

		await Effect.runPromise(game.disposeFx);
		expect(revokeObjectUrl.mock.calls).toEqual([
			[
				"blob:editor-hero",
			],
			[
				"blob:editor-water",
			],
		]);
		expect(() => game.getResourceUrlFn("item-water")).toThrow("unavailable");
		await expect(
			game.runFn(
				spawnItemFx({
					id: "runtime:after-dispose",
					itemId: "water",
					location: {
						scope: "inventory",
						position: {
							x: 0,
							y: 0,
						},
					},
					quantity: 1,
				}),
			),
		).rejects.toThrow("disposed");
	});
});

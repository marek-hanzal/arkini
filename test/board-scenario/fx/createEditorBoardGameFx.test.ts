import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { EditorProject } from "~/project-authoring/type/EditorProject";
import { createEditorBoardGameFx } from "~/board-scenario/fx/createEditorBoardGameFx";
import { spawnItemFx } from "~test/support/runtime/spawnItemFx";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

const project: EditorProject = {
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
		expect(game.getSnapshot().cheats).toEqual({
			enabled: true,
			everEnabled: true,
			instantGameplay: false,
		});
		expect(game.getSnapshot().items).toEqual([
			expect.objectContaining({
				item: expect.objectContaining({
					id: "water",
				}),
			}),
		]);
		expect(game.getResourceUrl("item-water")).toBe("blob:editor-water");
		expect(createObjectUrl).toHaveBeenCalledTimes(2);
		expect("arkpack" in game).toBe(false);
		expect("saveKey" in game).toBe(false);

		await game.run(
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
		expect(game.getSnapshot().items).toHaveLength(2);

		await Effect.runPromise(game.disposeFx);
		expect(revokeObjectUrl.mock.calls).toEqual([
			[
				"blob:editor-hero",
			],
			[
				"blob:editor-water",
			],
		]);
		expect(() => game.getResourceUrl("item-water")).toThrow("unavailable");
		await expect(
			game.run(
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

import type { BrowserWindow } from "electron";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { saveEditorProjectBuildFx } from "../../../electron/main/editor-project/saveEditorProjectBuildFx";
import { createEditorProjectIpcRepository } from "./ipc/support/createEditorProjectIpcRepository";

const electron = vi.hoisted(() => ({
	showSaveDialog: vi.fn(),
}));

vi.mock("electron", () => ({
	dialog: {
		showSaveDialog: electron.showSaveDialog,
	},
}));

const temporaryRoots: string[] = [];

afterEach(async () => {
	electron.showSaveDialog.mockReset();
	await Promise.all(
		temporaryRoots.splice(0).map((root) =>
			rm(root, {
				force: true,
				recursive: true,
			}),
		),
	);
});

describe("saveEditorProjectBuildFx", () => {
	it("publishes one local Editor Arkpack without release provenance", async () => {
		const root = await mkdtemp(join(tmpdir(), "arkini-editor-build-save-"));
		temporaryRoots.push(root);
		const repository = createEditorProjectIpcRepository();
		vi.mocked(repository.readProjectBuildFx).mockReturnValue(
			Effect.succeed({
				bytes: new Uint8Array([
					1,
					2,
					3,
				]),
			}),
		);
		electron.showSaveDialog.mockResolvedValue({
			canceled: false,
			filePath: join(root, "custom-name"),
		});
		const request = {
			projectId: "project.local",
			expectedRevision: 1,
			contentHash: "a".repeat(64),
		};

		await expect(
			Effect.runPromise(
				saveEditorProjectBuildFx({
					repository,
					request,
					window: {} as BrowserWindow,
				}),
			),
		).resolves.toBe(true);
		expect(repository.readProjectBuildFx).toHaveBeenCalledWith(request);
		await expect(readFile(join(root, "custom-name.arkpack"))).resolves.toEqual(
			Buffer.from([
				1,
				2,
				3,
			]),
		);
	});
});

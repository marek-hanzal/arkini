import type { BrowserWindow } from "electron";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { importEditorJsonDirectoryFx } from "../../../electron/main/editor-project/importEditorJsonDirectoryFx";
import { createEditorProjectIpcRepository } from "./ipc/support/createEditorProjectIpcRepository";

const electron = vi.hoisted(() => ({
	showOpenDialog: vi.fn(),
}));

vi.mock("electron", () => ({
	dialog: {
		showOpenDialog: electron.showOpenDialog,
	},
}));

const window = {} as BrowserWindow;
let directory = "";

beforeEach(async () => {
	electron.showOpenDialog.mockReset();
	directory = await mkdtemp(join(tmpdir(), "arkini-json-import-"));
});

afterEach(async () => {
	await rm(directory, {
		force: true,
		recursive: true,
	});
});

describe("importEditorJsonDirectoryFx", () => {
	it("opens the selected Editor folder directly in place", async () => {
		const repository = createEditorProjectIpcRepository();
		electron.showOpenDialog.mockResolvedValue({
			canceled: false,
			filePaths: [
				directory,
			],
		});

		const project = await Effect.runPromise(
			importEditorJsonDirectoryFx({
				repository,
				window,
			}),
		);

		expect(project?.projectId).toBe("project-one");
		expect(repository.openProjectFx).toHaveBeenCalledWith({
			root: directory,
		});
		expect(repository.createProjectFx).not.toHaveBeenCalled();
	});

	it("treats a canceled directory chooser as a no-op", async () => {
		const repository = createEditorProjectIpcRepository();
		electron.showOpenDialog.mockResolvedValue({
			canceled: true,
			filePaths: [],
		});

		await expect(
			Effect.runPromise(
				importEditorJsonDirectoryFx({
					repository,
					window,
				}),
			),
		).resolves.toBeNull();
		expect(repository.openProjectFx).not.toHaveBeenCalled();
	});
});

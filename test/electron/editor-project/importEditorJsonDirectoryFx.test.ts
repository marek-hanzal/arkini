import type { BrowserWindow } from "electron";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { importEditorJsonDirectoryFx } from "../../../electron/main/editor-project/importEditorJsonDirectoryFx";
import { createTestPngBytes } from "~test/bridge/arkpack/support/createTestPngBytes";
import { createRootSource } from "~test/validation/support/gameValidationTestSource";
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
	await mkdir(join(directory, "resources"));
	await writeFile(
		join(directory, "game.json"),
		JSON.stringify(createRootSource({ path: "game.json" }).value),
	);
	await writeFile(join(directory, "resources", "hero.png"), createTestPngBytes());
});

afterEach(async () => {
	await rm(directory, {
		force: true,
		recursive: true,
	});
});

describe("importEditorJsonDirectoryFx", () => {
	it("compiles the selected authoring directory into one canonical editor project", async () => {
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
		expect(repository.createProjectFx).toHaveBeenCalledOnce();
		const request = vi.mocked(repository.createProjectFx).mock.calls[0]?.[0];
		expect(request?.projectId).toBe("game:test");
		expect(request?.version).toBe("1.0");
		expect(request?.resources).toEqual([
			expect.objectContaining({
				id: "hero",
				mime: "image/png",
			}),
		]);
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
		expect(repository.createProjectFx).not.toHaveBeenCalled();
	});
});

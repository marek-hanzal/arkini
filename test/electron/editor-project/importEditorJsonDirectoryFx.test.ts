import type { BrowserWindow } from "electron";
import { fileURLToPath } from "node:url";
import { Effect } from "effect";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const ArkiniDirectory = fileURLToPath(new URL("../../../game/arkini/", import.meta.url));
const window = {} as BrowserWindow;

beforeEach(() => {
	electron.showOpenDialog.mockReset();
});

describe("importEditorJsonDirectoryFx", () => {
	it("compiles the selected authoring directory into one canonical editor project", async () => {
		const repository = createEditorProjectIpcRepository();
		electron.showOpenDialog.mockResolvedValue({
			canceled: false,
			filePaths: [
				ArkiniDirectory,
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
		expect(request?.projectId).toBe("arkini");
		expect(request?.version).toBe("1.0");
		expect(request?.resources.some(({ id }) => id === "hero")).toBe(true);
		expect(request?.resources.every(({ mime }) => mime === "image/png")).toBe(true);
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

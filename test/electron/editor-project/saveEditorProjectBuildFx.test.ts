import type { BrowserWindow } from "electron";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { saveEditorProjectBuildFx } from "~electron/main/editor-project/saveEditorProjectBuildFx";
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
		const source = join(root, "source.arkpack");
		await writeFile(source, Uint8Array.of(1, 2, 3));
		vi.mocked(repository.withProjectBuildPathFx).mockImplementation((_request, useFx) =>
			useFx(source),
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
		expect(repository.withProjectBuildPathFx).toHaveBeenCalledWith(
			request,
			expect.any(Function),
		);
		await expect(readFile(join(root, "custom-name.arkpack"))).resolves.toEqual(
			Buffer.from([
				1,
				2,
				3,
			]),
		);
	});
});

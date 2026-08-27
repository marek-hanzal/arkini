import type { BrowserWindow } from "electron";
import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { exportEditorJsonDirectoryFx } from "../../../electron/main/editor-project/exportEditorJsonDirectoryFx";
import { createEditorProjectIpcRepository } from "./ipc/support/createEditorProjectIpcRepository";
import {
	readReimportableProject,
	writeReimportableProject,
} from "./replaceEditorJsonExportDirectoryFx.test/harness";

const electron = vi.hoisted(() => {
	const paths = {
		app: "",
		home: "",
		userData: "",
	};
	return {
		getAppPath: vi.fn(() => paths.app),
		getPath: vi.fn((name: "home" | "userData") => paths[name]),
		paths,
		showMessageBox: vi.fn(),
		showOpenDialog: vi.fn(),
	};
});

vi.mock("electron", () => ({
	app: {
		getAppPath: electron.getAppPath,
		getPath: electron.getPath,
	},
	dialog: {
		showMessageBox: electron.showMessageBox,
		showOpenDialog: electron.showOpenDialog,
	},
}));

const window = {} as BrowserWindow;
const temporaryRoots: Array<string> = [];

beforeEach(async () => {
	electron.showMessageBox.mockReset();
	electron.showOpenDialog.mockReset();
	const protectedRoot = await mkdtemp(join(tmpdir(), "arkini-editor-export-protected-"));
	temporaryRoots.push(protectedRoot);
	electron.paths.app = join(protectedRoot, "app");
	electron.paths.home = join(protectedRoot, "home");
	electron.paths.userData = join(protectedRoot, "user-data");
	await Promise.all(
		Object.values(electron.paths).map((path) =>
			mkdir(path, {
				recursive: true,
			}),
		),
	);
});

afterEach(async () => {
	await Promise.all(
		temporaryRoots.splice(0).map((root) =>
			rm(root, {
				force: true,
				recursive: true,
			}),
		),
	);
});

describe("exportEditorJsonDirectoryFx", () => {
	it("replaces the target with a direct project-folder copy and drops transient files", async () => {
		const root = await mkdtemp(join(tmpdir(), "arkini-editor-export-"));
		temporaryRoots.push(root);
		const source = join(root, "source");
		const target = join(root, "target");
		await writeReimportableProject(source, 1);
		await Promise.all([
			mkdir(join(source, "notes"), {
				recursive: true,
			}),
			mkdir(join(source, "build"), {
				recursive: true,
			}),
			mkdir(target),
		]);
		await Promise.all([
			writeFile(
				join(source, "notes", "note.json"),
				'{"content":"kept","createdAtMs":1,"updatedAtMs":1}',
			),
			writeFile(join(source, "game.json.tmp"), "transient"),
			writeFile(join(source, "build", "derived.json"), "{}"),
			writeFile(
				join(source, "build", "derived.png"),
				new Uint8Array([
					1,
				]),
			),
			writeFile(join(target, "stale.txt"), "stale"),
		]);

		const repository = createEditorProjectIpcRepository();
		vi.mocked(repository.readProjectRootFx).mockReturnValue(Effect.succeed(source));
		electron.showOpenDialog.mockResolvedValue({
			canceled: false,
			filePaths: [
				target,
			],
		});
		electron.showMessageBox.mockResolvedValue({
			checkboxChecked: false,
			response: 1,
		});

		await expect(
			Effect.runPromise(
				exportEditorJsonDirectoryFx({
					projectId: "project-one",
					repository,
					window,
				}),
			),
		).resolves.toMatchObject({
			json: 5,
			resources: 2,
			revision: 1,
			root: await realpath(target),
		});
		await expect(readFile(join(target, "notes", "note.json"), "utf8")).resolves.toBe(
			'{"content":"kept","createdAtMs":1,"updatedAtMs":1}',
		);
		await expect(access(join(target, "stale.txt"))).rejects.toThrow();
		await expect(access(join(target, "editor.lock"))).rejects.toThrow();
		await expect(access(join(target, "game.json.tmp"))).rejects.toThrow();
		await expect(access(join(target, "build"))).rejects.toThrow();
		await expect(access(join(target, ".arkini-export-transaction"))).rejects.toThrow();
		expect((await readReimportableProject(target)).marker.revision).toBe(1);
	});

	it("leaves the selected folder untouched when replacement is canceled", async () => {
		const root = await mkdtemp(join(tmpdir(), "arkini-editor-export-cancel-"));
		temporaryRoots.push(root);
		const source = join(root, "source");
		const target = join(root, "target");
		await Promise.all([
			writeReimportableProject(source, 2),
			writeReimportableProject(target, 1),
		]);
		const repository = createEditorProjectIpcRepository();
		vi.mocked(repository.readProjectRootFx).mockReturnValue(Effect.succeed(source));
		electron.showOpenDialog.mockResolvedValue({
			canceled: false,
			filePaths: [
				target,
			],
		});
		electron.showMessageBox.mockResolvedValue({
			checkboxChecked: false,
			response: 0,
		});

		await expect(
			Effect.runPromise(
				exportEditorJsonDirectoryFx({
					projectId: "project-one",
					repository,
					window,
				}),
			),
		).resolves.toBeNull();
		expect((await readReimportableProject(target)).marker.revision).toBe(1);
	});
});

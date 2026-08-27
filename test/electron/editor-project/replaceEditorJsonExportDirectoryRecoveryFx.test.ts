import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect, type FileSystem } from "effect";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
	createEditorJsonExportTestHarness,
	type EditorJsonExportTestHarness,
	filesystemFailure,
	readNodeFileSystem,
	readReimportableProject,
	withEditorJsonExportPublishFailure,
	writeReimportableProject,
} from "./replaceEditorJsonExportDirectoryFx.test/harness";

const electron = vi.hoisted(() => ({
	paths: {
		app: "",
		home: "",
		userData: "",
	},
}));

vi.mock("electron", () => ({
	app: {
		getAppPath: () => electron.paths.app,
		getPath: (name: "home" | "userData") => electron.paths[name],
	},
}));

let harness: EditorJsonExportTestHarness;

beforeEach(async () => {
	harness = await createEditorJsonExportTestHarness();
	electron.paths.app = join(harness.root, "protected", "app");
	electron.paths.home = join(harness.root, "protected", "home");
	electron.paths.userData = join(harness.root, "protected", "user-data");
	await Promise.all(
		Object.values(electron.paths).map((path) =>
			mkdir(path, {
				recursive: true,
			}),
		),
	);
	await writeReimportableProject(harness.target, 1);
});

afterEach(async () => harness.close());

describe("replaceEditorJsonExportDirectoryFx recovery", () => {
	it("restores the previous valid export when publication fails", async () => {
		const fileSystem = await readNodeFileSystem();

		await expect(
			harness.replace(withEditorJsonExportPublishFailure(fileSystem, harness.target)),
		).rejects.toThrow(harness.target);
		expect((await readReimportableProject(harness.target)).marker.revision).toBe(1);
	});

	it("preserves the staged project when rollback restores an ordinary folder", async () => {
		await rm(harness.target, {
			recursive: true,
		});
		await mkdir(harness.target);
		await writeFile(join(harness.target, "notes.txt"), "keep exactly");
		const fileSystem = await readNodeFileSystem();
		let previousMoved = false;
		const failing: FileSystem.FileSystem = {
			...fileSystem,
			rename: (from, to) => {
				if (String(from) === harness.target && String(to).endsWith(".previous")) {
					previousMoved = true;
					return fileSystem.rename(from, to);
				}
				if (
					previousMoved &&
					String(from).endsWith(".pending") &&
					String(to) === harness.target
				)
					return Effect.fail(filesystemFailure("rename"));
				return fileSystem.rename(from, to);
			},
		};

		let failure: unknown;
		try {
			await harness.replace(failing);
		} catch (cause) {
			failure = cause;
		}
		const recoveryName = (await readdir(harness.root)).find((entry) =>
			entry.endsWith(".recovery"),
		);
		if (recoveryName === undefined) throw new Error("Staged recovery copy was not preserved.");
		const recovery = join(harness.root, recoveryName);
		expect(previousMoved).toBe(true);
		expect(failure).toMatchObject({
			message: expect.stringContaining(recovery),
		});
		expect(await readdir(harness.target)).toEqual([
			"notes.txt",
		]);
		await expect(readFile(join(harness.target, "notes.txt"), "utf8")).resolves.toBe(
			"keep exactly",
		);
		expect((await readReimportableProject(recovery)).marker.revision).toBe(2);

		await harness.recover();
		expect(await readdir(harness.recoveryRoot)).toEqual([]);
		expect((await readReimportableProject(recovery)).marker.revision).toBe(2);
	});

	it("retries restoration after the first backup copy failure", async () => {
		const fileSystem = await readNodeFileSystem();
		let restoreCopies = 0;
		const failing = withEditorJsonExportPublishFailure(fileSystem, harness.target, {
			copy: (from, to, options) => {
				if (String(from).endsWith(".previous") && String(to).endsWith(".restore")) {
					restoreCopies += 1;
					if (restoreCopies === 1) return Effect.fail(filesystemFailure("copy"));
				}
				return fileSystem.copy(from, to, options);
			},
		});

		await expect(harness.replace(failing)).rejects.toThrow(harness.target);
		expect(restoreCopies).toBe(2);
		expect((await readReimportableProject(harness.target)).marker.revision).toBe(1);
	});

	it("keeps a stable staged recovery after both restore attempts fail", async () => {
		await rm(harness.target, {
			recursive: true,
		});
		await mkdir(harness.target);
		await writeFile(join(harness.target, "notes.txt"), "restore later");
		const fileSystem = await readNodeFileSystem();
		let restoreCopies = 0;
		const failing = withEditorJsonExportPublishFailure(fileSystem, harness.target, {
			copy: (from, to, options) => {
				if (String(from).endsWith(".previous") && String(to).endsWith(".restore")) {
					restoreCopies += 1;
					return Effect.fail(filesystemFailure("copy"));
				}
				return fileSystem.copy(from, to, options);
			},
		});

		let failure: unknown;
		try {
			await harness.replace(failing);
		} catch (cause) {
			failure = cause;
		}
		const recoveryName = (await readdir(harness.root)).find((entry) =>
			entry.endsWith(".recovery"),
		);
		if (recoveryName === undefined) throw new Error("Staged export was not preserved.");
		const recovery = join(harness.root, recoveryName);
		expect(restoreCopies).toBe(2);
		expect(failure).toMatchObject({
			message: expect.stringContaining(recovery),
		});
		expect((await readReimportableProject(recovery)).marker.revision).toBe(2);

		await harness.recover();
		expect(await readdir(harness.target)).toEqual([
			"notes.txt",
		]);
		await expect(readFile(join(harness.target, "notes.txt"), "utf8")).resolves.toBe(
			"restore later",
		);
		expect((await readReimportableProject(recovery)).marker.revision).toBe(2);
	});

	it("reports the restored target when only terminal journal cleanup fails", async () => {
		const fileSystem = await readNodeFileSystem();
		let previousRemoved = false;
		let cleanupFailed = false;
		const failing = withEditorJsonExportPublishFailure(fileSystem, harness.target, {
			open: (path, options) =>
				previousRemoved && !cleanupFailed && String(path) === harness.root
					? Effect.sync(() => (cleanupFailed = true)).pipe(
							Effect.andThen(Effect.fail(filesystemFailure("open"))),
						)
					: fileSystem.open(path, options),
			remove: (path, options) =>
				fileSystem.remove(path, options).pipe(
					Effect.tap(() =>
						Effect.sync(() => {
							previousRemoved ||= String(path).endsWith(".previous");
						}),
					),
				),
		});

		await expect(harness.replace(failing)).rejects.toThrow(harness.target);
		expect(cleanupFailed).toBe(true);
		expect((await readReimportableProject(harness.target)).marker.revision).toBe(1);
	});
});

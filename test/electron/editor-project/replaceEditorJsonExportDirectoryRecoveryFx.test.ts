import { mkdir, readdir } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
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

	it("preserves and reports the previous export when both restore attempts fail", async () => {
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
		const previousName = (await readdir(harness.root)).find((entry) =>
			entry.endsWith(".previous"),
		);
		if (previousName === undefined) throw new Error("Previous export was not preserved.");
		const previous = join(harness.root, previousName);
		expect(restoreCopies).toBe(2);
		expect(failure).toMatchObject({
			message: expect.stringContaining(previous),
		});
		expect((await readReimportableProject(previous)).marker.revision).toBe(1);
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

import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, PlatformError } from "effect";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFilesystemLauncherPreferencesFx } from "../../electron/main/launcher/createFilesystemLauncherPreferencesFx";

let root = "";
const preferenceDirectory = () => join(root, "arkini", "preferences");
const currentPath = () => join(preferenceDirectory(), "launcher.last-package");
const pendingPath = () => join(preferenceDirectory(), "launcher-last-package.pending");

const createPreferences = () =>
	Effect.runPromise(
		createFilesystemLauncherPreferencesFx({
			userDataPath: root,
		}).pipe(Effect.provide(NodeServices.layer)),
	);

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-launcher-"));
});

afterEach(async () => {
	await rm(root, {
		recursive: true,
		force: true,
	});
});

describe("createFilesystemLauncherPreferencesFx", () => {
	it("recovers missing or malformed package identity to no prior package", async () => {
		const preferences = await createPreferences();
		expect(await Effect.runPromise(preferences.readLastPackageIdFx)).toBeNull();
		await mkdir(preferenceDirectory(), {
			recursive: true,
		});
		await writeFile(currentPath(), "   ", "utf8");
		expect(await Effect.runPromise(preferences.readLastPackageIdFx)).toBeNull();
	});

	it("round-trips one normalized package identity atomically", async () => {
		const preferences = await createPreferences();
		await Effect.runPromise(preferences.writeLastPackageIdFx("  package:test  "));
		expect(await readFile(currentPath(), "utf8")).toBe("package:test");
		expect(await Effect.runPromise(preferences.readLastPackageIdFx)).toBe("package:test");
		await expect(access(pendingPath())).rejects.toBeDefined();
	});

	it("preserves the committed package when atomic replacement fails", async () => {
		const preferences = await createPreferences();
		await Effect.runPromise(preferences.writeLastPackageIdFx("package:first"));
		const failing = await Effect.runPromise(
			Effect.gen(function* () {
				const fileSystem = yield* FileSystem.FileSystem;
				return yield* createFilesystemLauncherPreferencesFx({
					userDataPath: root,
					fileSystem: {
						...fileSystem,
						rename: () =>
							Effect.fail(
								PlatformError.systemError({
									_tag: "Unknown",
									module: "FileSystem",
									method: "rename",
									description: "rename failed",
								}),
							),
					},
				});
			}).pipe(Effect.provide(NodeServices.layer)),
		);

		await expect(
			Effect.runPromise(failing.writeLastPackageIdFx("package:second")),
		).rejects.toThrow("persist the last package preference");
		expect(await readFile(currentPath(), "utf8")).toBe("package:first");
		await expect(access(pendingPath())).rejects.toBeDefined();
	});

	it("rejects an empty package identity", async () => {
		const preferences = await createPreferences();
		await expect(Effect.runPromise(preferences.writeLastPackageIdFx(" "))).rejects.toThrow(
			"persist the last package preference",
		);
		await expect(access(currentPath())).rejects.toBeDefined();
	});
});

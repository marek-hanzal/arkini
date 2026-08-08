import { NodeServices } from "@effect/platform-node";
import { Deferred, Effect, FileSystem, Option, PlatformError } from "effect";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFilesystemLauncherPreferencesFx } from "../../electron/main/launcher/createFilesystemLauncherPreferencesFx";

let root = "";
const preferenceDirectory = () => join(root, "arkini", "game", "preferences");
const currentPath = () => join(preferenceDirectory(), "launcher.last-package");
const pendingPath = () => join(preferenceDirectory(), "launcher-last-package.pending");

const createPreferences = (fileSystem?: FileSystem.FileSystem) =>
	Effect.runPromise(
		createFilesystemLauncherPreferencesFx({
			root: preferenceDirectory(),
			fileSystem,
		}).pipe(Effect.provide(NodeServices.layer)),
	);

const readNodeFileSystem = () =>
	Effect.runPromise(FileSystem.FileSystem.pipe(Effect.provide(NodeServices.layer)));

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

	it("serializes concurrent writes before either can reuse the shared pending path", async () => {
		const fileSystem = await readNodeFileSystem();
		const firstRenameEntered = Effect.runSync(Deferred.make<void>());
		const releaseFirstRename = Effect.runSync(Deferred.make<void>());
		const secondRenameEntered = Effect.runSync(Deferred.make<void>());
		let renameCalls = 0;
		const preferences = await createPreferences({
			...fileSystem,
			rename: (oldPath, newPath) =>
				Effect.suspend(() => {
					renameCalls += 1;
					const rename = fileSystem.rename(oldPath, newPath);
					if (renameCalls === 1) {
						return Deferred.succeed(firstRenameEntered, undefined).pipe(
							Effect.andThen(Deferred.await(releaseFirstRename)),
							Effect.andThen(rename),
						);
					}
					return Deferred.succeed(secondRenameEntered, undefined).pipe(
						Effect.andThen(rename),
					);
				}),
		});
		const firstWrite = Effect.runPromise(preferences.writeLastPackageIdFx("package:first"));
		await Effect.runPromise(Deferred.await(firstRenameEntered));

		const secondWrite = Effect.runPromise(preferences.writeLastPackageIdFx("package:second"));
		expect(Option.isNone(await Effect.runPromise(Deferred.poll(secondRenameEntered)))).toBe(
			true,
		);

		Effect.runSync(Deferred.succeed(releaseFirstRename, undefined));
		await Promise.all([
			firstWrite,
			secondWrite,
		]);

		expect(await Effect.runPromise(preferences.readLastPackageIdFx)).toBe("package:second");
		await expect(access(pendingPath())).rejects.toBeDefined();
	});

	it("preserves the committed package when atomic replacement fails", async () => {
		const preferences = await createPreferences();
		await Effect.runPromise(preferences.writeLastPackageIdFx("package:first"));
		const failing = await Effect.runPromise(
			Effect.gen(function* () {
				const fileSystem = yield* FileSystem.FileSystem;
				return yield* createFilesystemLauncherPreferencesFx({
					root: preferenceDirectory(),
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

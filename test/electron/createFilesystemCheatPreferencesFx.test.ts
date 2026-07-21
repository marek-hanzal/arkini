import { FileSystem } from "@effect/platform";
import { SystemError } from "@effect/platform/Error";
import { NodeContext } from "@effect/platform-node";
import { Effect } from "effect";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFilesystemCheatPreferencesFx } from "../../electron/main/cheat/createFilesystemCheatPreferencesFx";

let root = "";
const preferenceDirectory = () => join(root, "arkini", "preferences");
const currentPath = () => join(preferenceDirectory(), "cheats.available");
const pendingPath = () => join(preferenceDirectory(), "cheats-available.pending");

const createPreferences = () =>
	Effect.runPromise(
		createFilesystemCheatPreferencesFx({
			userDataPath: root,
		}).pipe(Effect.provide(NodeContext.layer)),
	);

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-cheats-"));
});

afterEach(async () => {
	await rm(root, {
		recursive: true,
		force: true,
	});
});

describe("createFilesystemCheatPreferencesFx", () => {
	it("defaults missing or malformed availability to false", async () => {
		const preferences = await createPreferences();
		expect(await Effect.runPromise(preferences.readAvailableFx)).toBe(false);
		await mkdir(preferenceDirectory(), {
			recursive: true,
		});
		await writeFile(currentPath(), "perhaps", "utf8");
		expect(await Effect.runPromise(preferences.readAvailableFx)).toBe(false);
	});

	it("round-trips both explicit values", async () => {
		const preferences = await createPreferences();
		for (const available of [
			true,
			false,
		] as const) {
			await Effect.runPromise(preferences.writeAvailableFx(available));
			expect(await readFile(currentPath(), "utf8")).toBe(String(available));
			expect(await Effect.runPromise(preferences.readAvailableFx)).toBe(available);
			await expect(access(pendingPath())).rejects.toBeDefined();
		}
	});

	it("preserves the committed preference when atomic replacement fails", async () => {
		const preferences = await createPreferences();
		await Effect.runPromise(preferences.writeAvailableFx(false));
		const failing = await Effect.runPromise(
			Effect.gen(function* () {
				const fileSystem = yield* FileSystem.FileSystem;
				return yield* createFilesystemCheatPreferencesFx({
					userDataPath: root,
					fileSystem: {
						...fileSystem,
						rename: () =>
							Effect.fail(
								new SystemError({
									reason: "Unknown",
									module: "FileSystem",
									method: "rename",
									description: "rename failed",
								}),
							),
					},
				});
			}).pipe(Effect.provide(NodeContext.layer)),
		);

		await expect(Effect.runPromise(failing.writeAvailableFx(true))).rejects.toThrow(
			"persist the cheat availability preference",
		);
		expect(await readFile(currentPath(), "utf8")).toBe("false");
		await expect(access(pendingPath())).rejects.toBeDefined();
	});

	it("rejects unsupported values instead of persisting them", async () => {
		const preferences = await createPreferences();
		await expect(
			Effect.runPromise(preferences.writeAvailableFx("yes" as never)),
		).rejects.toThrow("persist the cheat availability preference");
		await expect(access(currentPath())).rejects.toBeDefined();
	});
});

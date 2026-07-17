import { FileSystem } from "@effect/platform";
import { SystemError } from "@effect/platform/Error";
import { NodeContext } from "@effect/platform-node";
import { Effect } from "effect";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFilesystemAppearancePreferencesFx } from "../../electron/main/appearance/createFilesystemAppearancePreferencesFx";

let root = "";
const preferenceDirectory = () => join(root, "arkini", "preferences");
const currentPath = () => join(preferenceDirectory(), "appearance.theme");
const pendingPath = () => join(preferenceDirectory(), "appearance.pending");

const createPreferences = () =>
	Effect.runPromise(
		createFilesystemAppearancePreferencesFx({
			userDataPath: root,
		}).pipe(Effect.provide(NodeContext.layer)),
	);

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-appearance-"));
});

afterEach(async () => {
	await rm(root, {
		recursive: true,
		force: true,
	});
});

describe("createFilesystemAppearancePreferencesFx", () => {
	it("defaults missing or malformed preference data to dark", async () => {
		const preferences = await createPreferences();
		expect(await Effect.runPromise(preferences.readFx)).toBe("dark");

		await mkdir(preferenceDirectory(), {
			recursive: true,
		});
		await writeFile(currentPath(), "sepia", "utf8");

		expect(await Effect.runPromise(preferences.readFx)).toBe("dark");
	});

	it("round-trips every explicit preference including system", async () => {
		const preferences = await createPreferences();
		for (const theme of [
			"dark",
			"light",
			"system",
		] as const) {
			await Effect.runPromise(preferences.writeFx(theme));
			expect(await readFile(currentPath(), "utf8")).toBe(theme);
			expect(await Effect.runPromise(preferences.readFx)).toBe(theme);
			await expect(access(pendingPath())).rejects.toBeDefined();
		}
	});

	it("preserves the committed preference when atomic replacement fails", async () => {
		const preferences = await createPreferences();
		await Effect.runPromise(preferences.writeFx("dark"));
		const failing = await Effect.runPromise(
			Effect.gen(function* () {
				const fileSystem = yield* FileSystem.FileSystem;
				return yield* createFilesystemAppearancePreferencesFx({
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

		await expect(Effect.runPromise(failing.writeFx("light"))).rejects.toThrow(
			"persist the appearance preference",
		);
		expect(await readFile(currentPath(), "utf8")).toBe("dark");
		await expect(access(pendingPath())).rejects.toBeDefined();
	});

	it("rejects unsupported values instead of persisting them", async () => {
		const preferences = await createPreferences();
		await expect(Effect.runPromise(preferences.writeFx("sepia" as never))).rejects.toThrow(
			"Electron main operation failed: persist the appearance preference",
		);
		await expect(access(currentPath())).rejects.toBeDefined();
	});
});

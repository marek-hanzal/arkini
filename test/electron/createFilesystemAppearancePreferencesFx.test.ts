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
const themePath = () => join(preferenceDirectory(), "appearance.theme");
const themePendingPath = () => join(preferenceDirectory(), "appearance.pending");
const accentPath = () => join(preferenceDirectory(), "appearance.accent");
const accentPendingPath = () => join(preferenceDirectory(), "appearance-accent.pending");

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
	it("defaults missing or malformed preferences to dark and rose", async () => {
		const preferences = await createPreferences();
		expect(await Effect.runPromise(preferences.readThemeFx)).toBe("dark");
		expect(await Effect.runPromise(preferences.readAccentFx)).toBe("rose");

		await mkdir(preferenceDirectory(), {
			recursive: true,
		});
		await writeFile(themePath(), "sepia", "utf8");
		await writeFile(accentPath(), "ultraviolet", "utf8");

		expect(await Effect.runPromise(preferences.readThemeFx)).toBe("dark");
		expect(await Effect.runPromise(preferences.readAccentFx)).toBe("rose");
	});

	it("round-trips every explicit theme and accent", async () => {
		const preferences = await createPreferences();
		for (const theme of [
			"dark",
			"light",
			"system",
		] as const) {
			await Effect.runPromise(preferences.writeThemeFx(theme));
			expect(await readFile(themePath(), "utf8")).toBe(theme);
			expect(await Effect.runPromise(preferences.readThemeFx)).toBe(theme);
			await expect(access(themePendingPath())).rejects.toBeDefined();
		}
		for (const accent of [
			"rose",
			"violet",
			"blue",
			"green",
			"amber",
		] as const) {
			await Effect.runPromise(preferences.writeAccentFx(accent));
			expect(await readFile(accentPath(), "utf8")).toBe(accent);
			expect(await Effect.runPromise(preferences.readAccentFx)).toBe(accent);
			await expect(access(accentPendingPath())).rejects.toBeDefined();
		}
	});

	it("preserves committed preferences when atomic replacement fails", async () => {
		const preferences = await createPreferences();
		await Effect.runPromise(preferences.writeThemeFx("dark"));
		await Effect.runPromise(preferences.writeAccentFx("rose"));
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

		await expect(Effect.runPromise(failing.writeThemeFx("light"))).rejects.toThrow(
			"persist the appearance preference",
		);
		await expect(Effect.runPromise(failing.writeAccentFx("blue"))).rejects.toThrow(
			"persist the appearance accent preference",
		);
		expect(await readFile(themePath(), "utf8")).toBe("dark");
		expect(await readFile(accentPath(), "utf8")).toBe("rose");
		await expect(access(themePendingPath())).rejects.toBeDefined();
		await expect(access(accentPendingPath())).rejects.toBeDefined();
	});

	it("rejects unsupported values instead of persisting them", async () => {
		const preferences = await createPreferences();
		await expect(Effect.runPromise(preferences.writeThemeFx("sepia" as never))).rejects.toThrow(
			"Electron main operation failed: persist the appearance preference",
		);
		await expect(
			Effect.runPromise(preferences.writeAccentFx("ultraviolet" as never)),
		).rejects.toThrow(
			"Electron main operation failed: persist the appearance accent preference",
		);
		await expect(access(themePath())).rejects.toBeDefined();
		await expect(access(accentPath())).rejects.toBeDefined();
	});
});

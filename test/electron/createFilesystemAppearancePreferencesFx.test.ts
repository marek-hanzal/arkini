import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFilesystemAppearancePreferencesFx } from "../../electron/main/appearance/createFilesystemAppearancePreferencesFx";

let root = "";
const preferenceDirectory = () => join(root, "arkini", "game", "preferences");
const themePath = () => join(preferenceDirectory(), "appearance.theme.json");
const accentPath = () => join(preferenceDirectory(), "appearance.accent.json");

const createPreferences = () =>
	Effect.runPromise(
		createFilesystemAppearancePreferencesFx({
			root: preferenceDirectory(),
		}).pipe(Effect.provide(NodeServices.layer)),
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
			expect(await readFile(themePath(), "utf8")).toBe(JSON.stringify(theme));
			expect(await Effect.runPromise(preferences.readThemeFx)).toBe(theme);
		}
		for (const accent of [
			"rose",
			"violet",
			"blue",
			"green",
			"amber",
		] as const) {
			await Effect.runPromise(preferences.writeAccentFx(accent));
			expect(await readFile(accentPath(), "utf8")).toBe(JSON.stringify(accent));
			expect(await Effect.runPromise(preferences.readAccentFx)).toBe(accent);
		}
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

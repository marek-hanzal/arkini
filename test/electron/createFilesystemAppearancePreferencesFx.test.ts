import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
	it("round-trips both appearance files atomically", async () => {
		const preferences = await createPreferences();
		await Effect.runPromise(preferences.writeThemeFx("light"));
		await Effect.runPromise(preferences.writeAccentFx("blue"));
		expect(await readFile(themePath(), "utf8")).toBe('"light"');
		expect(await readFile(accentPath(), "utf8")).toBe('"blue"');
		expect(await Effect.runPromise(preferences.readThemeFx)).toBe("light");
		expect(await Effect.runPromise(preferences.readAccentFx)).toBe("blue");
	});
});

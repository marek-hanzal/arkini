import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFilesystemCheatPreferencesFx } from "../../electron/main/cheat/createFilesystemCheatPreferencesFx";

let root = "";
const preferenceDirectory = () => join(root, "arkini", "game", "preferences");
const currentPath = () => join(preferenceDirectory(), "cheats.available.json");

const createPreferences = () =>
	Effect.runPromise(
		createFilesystemCheatPreferencesFx({
			root: preferenceDirectory(),
		}).pipe(Effect.provide(NodeServices.layer)),
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
	it("round-trips availability atomically", async () => {
		const preferences = await createPreferences();
		await Effect.runPromise(preferences.writeAvailableFx(true));
		expect(await readFile(currentPath(), "utf8")).toBe("true");
		expect(await Effect.runPromise(preferences.readAvailableFx)).toBe(true);
	});
});

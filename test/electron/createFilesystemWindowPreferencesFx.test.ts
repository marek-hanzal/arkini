import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFilesystemWindowPreferencesFx } from "~electron/main/window/createFilesystemWindowPreferencesFx";

let root = "";
const preferenceDirectory = () => join(root, "arkini", "game", "preferences");
const modePath = () => join(preferenceDirectory(), "window.mode.json");

const createPreferences = () =>
	Effect.runPromise(
		createFilesystemWindowPreferencesFx({
			root: preferenceDirectory(),
		}).pipe(Effect.provide(NodeServices.layer)),
	);

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-window-"));
});

afterEach(async () => {
	await rm(root, {
		recursive: true,
		force: true,
	});
});

describe("createFilesystemWindowPreferencesFx", () => {
	it("round-trips one native window mode atomically", async () => {
		const preferences = await createPreferences();
		await Effect.runPromise(preferences.writeModeFx("fullscreen"));
		expect(await readFile(modePath(), "utf8")).toBe('"fullscreen"');
		expect(await Effect.runPromise(preferences.readModeFx)).toBe("fullscreen");
	});
});

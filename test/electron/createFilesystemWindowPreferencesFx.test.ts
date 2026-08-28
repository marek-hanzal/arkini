import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFilesystemWindowPreferencesFx } from "../../electron/main/window/createFilesystemWindowPreferencesFx";

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
	it("defaults missing or malformed preferences to default mode", async () => {
		const preferences = await createPreferences();
		expect(await Effect.runPromise(preferences.readModeFx)).toBe("default");

		await mkdir(preferenceDirectory(), {
			recursive: true,
		});
		await writeFile(modePath(), "floating", "utf8");

		expect(await Effect.runPromise(preferences.readModeFx)).toBe("default");
	});

	it("round-trips every native window mode atomically", async () => {
		const preferences = await createPreferences();
		for (const mode of [
			"default",
			"bordered",
			"fullscreen",
		] as const) {
			await Effect.runPromise(preferences.writeModeFx(mode));
			expect(await readFile(modePath(), "utf8")).toBe(JSON.stringify(mode));
			expect(await Effect.runPromise(preferences.readModeFx)).toBe(mode);
		}
	});

	it("rejects unsupported modes instead of persisting them", async () => {
		const preferences = await createPreferences();
		await expect(
			Effect.runPromise(preferences.writeModeFx("floating" as never)),
		).rejects.toThrow("Electron main operation failed: persist the window mode preference");
		await expect(access(modePath())).rejects.toBeDefined();
	});
});

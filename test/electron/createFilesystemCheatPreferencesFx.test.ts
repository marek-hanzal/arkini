import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
		}
	});

	it("rejects unsupported values instead of persisting them", async () => {
		const preferences = await createPreferences();
		await expect(
			Effect.runPromise(preferences.writeAvailableFx("yes" as never)),
		).rejects.toThrow("persist the cheat availability preference");
		await expect(access(currentPath())).rejects.toBeDefined();
	});
});

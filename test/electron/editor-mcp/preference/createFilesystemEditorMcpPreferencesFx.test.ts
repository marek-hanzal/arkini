import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect } from "effect";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
	createFilesystemEditorMcpPreferencesFx,
	DefaultEditorMcpPort,
} from "../../../../electron/main/editor-mcp/preference/createFilesystemEditorMcpPreferencesFx";

let root = "";
const preferenceDirectory = () => join(root, "arkini", "game", "preferences");
const currentPath = () => join(preferenceDirectory(), "editor-mcp.port");
const pendingPath = () => join(preferenceDirectory(), "editor-mcp.pending");

const createPreferences = () =>
	Effect.runPromise(
		createFilesystemEditorMcpPreferencesFx({
			root: preferenceDirectory(),
		}).pipe(Effect.provide(NodeServices.layer)),
	);

beforeEach(async () => {
	root = await mkdtemp(join(tmpdir(), "arkini-editor-mcp-preferences-"));
});

afterEach(async () => {
	await rm(root, {
		force: true,
		recursive: true,
	});
});

describe("createFilesystemEditorMcpPreferencesFx", () => {
	it("uses the global default when the preference is missing", async () => {
		const preferences = await createPreferences();

		expect(await Effect.runPromise(preferences.readPortFx)).toBe(DefaultEditorMcpPort);
	});

	it("round-trips a valid port through the atomic preference file", async () => {
		const preferences = await createPreferences();

		await Effect.runPromise(preferences.writePortFx(45_678));

		expect(await readFile(currentPath(), "utf8")).toBe("45678");
		expect(await Effect.runPromise(preferences.readPortFx)).toBe(45_678);
		await expect(access(pendingPath())).rejects.toBeDefined();
	});

	it("falls back from malformed or out-of-range persisted ports", async () => {
		const preferences = await createPreferences();
		await mkdir(preferenceDirectory(), {
			recursive: true,
		});

		for (const stored of [
			"not-a-port",
			"1023",
			"65536",
			"32310.5",
		] as const) {
			await writeFile(currentPath(), stored, "utf8");
			expect(await Effect.runPromise(preferences.readPortFx)).toBe(DefaultEditorMcpPort);
		}
	});

	it("rejects invalid writes without replacing a committed port", async () => {
		const preferences = await createPreferences();
		await Effect.runPromise(preferences.writePortFx(45_678));

		await expect(Effect.runPromise(preferences.writePortFx(1_023 as never))).rejects.toThrow(
			"persist the editor MCP port preference",
		);
		expect(await readFile(currentPath(), "utf8")).toBe("45678");
		await expect(access(pendingPath())).rejects.toBeDefined();
	});
});

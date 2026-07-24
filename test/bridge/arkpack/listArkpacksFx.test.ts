import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArkiniArkpack } from "~/bridge/arkpack/ArkiniArkpack";
import type { ArkpackStorage } from "~/bridge/arkpack/ArkpackStorage";
import { DemoArkpack } from "~/bridge/arkpack/DemoArkpack";
import { listArkpacksFx } from "~/bridge/arkpack/listArkpacksFx";

const imported = {
	packageId: "a".repeat(64),
	contentHash: "a".repeat(64),
	gameId: "local",
	title: "Local package",
	configVersion: "1.0",
	compressedSize: 128,
	trust: {
		type: "external",
		reason: "unsigned",
	} as const,
	source: "imported" as const,
	filename: "local.arkpack",
	importedAtMs: 1,
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("listArkpacksFx", () => {
	it("lists signed and unsigned bundled metadata before imports without reading payloads", async () => {
		const fetch = vi.fn();
		const list = vi.fn();
		const read = vi.fn();
		vi.stubGlobal("fetch", fetch);
		const storage: ArkpackStorage = {
			listFx: Effect.sync(() => {
				list();
				return [
					imported,
				];
			}),
			readFx: () =>
				Effect.sync(() => {
					read();
					throw new Error("catalog listing must not read an exact payload");
				}),
			removeFx: () => Effect.void,
			writeFx: () => Effect.void,
		};

		await expect(
			Effect.runPromise(
				listArkpacksFx({
					storage,
				}),
			),
		).resolves.toEqual([
			ArkiniArkpack.descriptor,
			DemoArkpack.descriptor,
			imported,
		]);
		expect(fetch).not.toHaveBeenCalled();
		expect(list).toHaveBeenCalledOnce();
		expect(read).not.toHaveBeenCalled();
	});
});

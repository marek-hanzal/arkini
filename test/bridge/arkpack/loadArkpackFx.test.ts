import { readFile } from "node:fs/promises";
import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ArkiniArkpack } from "~/bridge/arkpack/ArkiniArkpack";
import { DemoArkpack } from "~/bridge/arkpack/DemoArkpack";
import { loadArkpackFx } from "~/bridge/arkpack/loadArkpackFx";
import { createTestArkpack } from "~test/bridge/arkpack/support/createTestArkpack";

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("loadArkpackFx official package", () => {
	it("reads and fully revalidates the selected bundled binary against catalog metadata", async () => {
		const bytes = await readFile("game/arkini.game.arkpack");
		const signature = await readFile("game/arkini.game.arkpack.sig", "utf8");
		const fetch = vi.fn((input: string) =>
			Promise.resolve(new Response(input === ArkiniArkpack.signatureUrl ? signature : bytes)),
		);
		vi.stubGlobal("fetch", fetch);

		const loaded = await Effect.runPromise(
			loadArkpackFx({
				packageId: ArkiniArkpack.packageId,
			}),
		);

		expect(fetch).toHaveBeenCalledTimes(2);
		expect(fetch).toHaveBeenNthCalledWith(1, ArkiniArkpack.url);
		expect(fetch).toHaveBeenNthCalledWith(2, ArkiniArkpack.signatureUrl);
		expect(loaded.descriptor).toEqual(ArkiniArkpack.descriptor);
		expect(loaded.payload.config.meta.id).toBe("arkini");
	});

	it("fails closed before decode when official bytes do not match the detached signature", async () => {
		const signature = await readFile("game/arkini.game.arkpack.sig", "utf8");
		vi.stubGlobal(
			"fetch",
			vi.fn((input: string) =>
				Promise.resolve(
					new Response(
						input === ArkiniArkpack.signatureUrl ? signature : createTestArkpack(),
					),
				),
			),
		);

		await expect(
			Effect.runPromise(
				loadArkpackFx({
					packageId: ArkiniArkpack.packageId,
				}),
			),
		).rejects.toThrow("expected official signature");
	});

	it("fails closed when the official detached signature is missing", async () => {
		const bytes = await readFile("game/arkini.game.arkpack");
		vi.stubGlobal(
			"fetch",
			vi.fn((input: string) =>
				Promise.resolve(
					input === ArkiniArkpack.signatureUrl
						? new Response(undefined, {
								status: 404,
								statusText: "Not Found",
							})
						: new Response(bytes),
				),
			),
		);

		await expect(
			Effect.runPromise(
				loadArkpackFx({
					packageId: ArkiniArkpack.packageId,
				}),
			),
		).rejects.toThrow("Unable to load bundled arkini signature");
	});

	it("loads the bundled unsigned demo as external content", async () => {
		const bytes = await readFile("game/demo.game.arkpack");
		const fetch = vi.fn().mockResolvedValue(new Response(bytes));
		vi.stubGlobal("fetch", fetch);

		const loaded = await Effect.runPromise(
			loadArkpackFx({
				packageId: DemoArkpack.packageId,
			}),
		);

		expect(fetch).toHaveBeenCalledOnce();
		expect(fetch).toHaveBeenCalledWith(DemoArkpack.url);
		expect(loaded.descriptor).toEqual(DemoArkpack.descriptor);
		expect(loaded.descriptor.trust).toEqual({
			type: "external",
			reason: "unsigned",
		});
		expect(loaded.payload.config.meta.id).toBe("demo");
	});
});

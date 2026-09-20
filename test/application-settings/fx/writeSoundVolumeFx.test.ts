// @vitest-environment jsdom

import { Effect } from "effect";
import { afterEach, describe, expect, it, vi } from "vitest";

import { writeSoundVolumeFx } from "~/application-settings/fx/writeSoundVolumeFx";

afterEach(() => {
	Reflect.deleteProperty(window, "serakki");
});

describe("writeSoundVolumeFx", () => {
	it("persists rapid volume changes in admission order", async () => {
		let releaseFirstFn: () => void = () => undefined;
		const first = new Promise<void>((resolve) => {
			releaseFirstFn = resolve;
		});
		const writeFn = vi
			.fn()
			.mockImplementationOnce(() => first)
			.mockResolvedValue(undefined);
		Object.defineProperty(window, "serakki", {
			configurable: true,
			value: {
				sound: {
					writeFn,
				},
			},
		});

		const firstWrite = Effect.runPromise(writeSoundVolumeFx("master", 20));
		const secondWrite = Effect.runPromise(writeSoundVolumeFx("master", 80));
		await vi.waitFor(() => expect(writeFn).toHaveBeenCalledTimes(1));
		expect(writeFn).toHaveBeenNthCalledWith(1, "master", 20);

		releaseFirstFn();
		await Promise.all([
			firstWrite,
			secondWrite,
		]);
		expect(writeFn).toHaveBeenNthCalledWith(2, "master", 80);
	});
});

import { Effect } from "effect";
import { beforeEach, expect, it, vi } from "vitest";

import { readGraphicsAvailabilityFx } from "~/tile-rendering/fx/readGraphicsAvailabilityFx";

const { isWebGLSupportedFn, isWebGPUSupportedFn } = vi.hoisted(() => ({
	isWebGLSupportedFn: vi.fn(),
	isWebGPUSupportedFn: vi.fn(),
}));

vi.mock("pixi.js", () => ({
	isWebGLSupported: isWebGLSupportedFn,
	isWebGPUSupported: isWebGPUSupportedFn,
}));

beforeEach(() => {
	isWebGLSupportedFn.mockReset();
	isWebGPUSupportedFn.mockReset();
});

it("admits WebGPU without WebGL and rejects startup when both GPU backends are unavailable", async () => {
	isWebGLSupportedFn.mockReturnValue(false);
	isWebGPUSupportedFn.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

	expect(await Effect.runPromise(readGraphicsAvailabilityFx())).toBe(true);
	expect(await Effect.runPromise(readGraphicsAvailabilityFx())).toBe(false);
	expect(isWebGPUSupportedFn).toHaveBeenCalledTimes(2);

	isWebGLSupportedFn.mockReturnValue(true);
	expect(await Effect.runPromise(readGraphicsAvailabilityFx())).toBe(true);
	expect(isWebGPUSupportedFn).toHaveBeenCalledTimes(2);
});

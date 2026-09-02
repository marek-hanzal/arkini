import { Effect, Fiber, Result } from "effect";
import { TestClock } from "effect/testing";
import { describe, expect, it } from "@effect/vitest";
import { afterEach, vi } from "vitest";

import { checkRemoteEndpointFx } from "~/authoring-mcp/http/checkRemoteEndpointFx";

afterEach(() => vi.unstubAllGlobals());

const response = (status: number) =>
	new Response(null, {
		status,
	});

const pendingResponse = (init: RequestInit | undefined, signals: Array<AbortSignal>) =>
	new Promise<Response>((_resolve, reject) => {
		const signal = init?.signal;
		if (!(signal instanceof AbortSignal)) throw new Error("Missing abort signal");
		signals.push(signal);
		signal.addEventListener("abort", () => reject(signal.reason), {
			once: true,
		});
	});

describe("checkRemoteEndpointFx", () => {
	it.effect("times out one attempt before retrying a healthy endpoint", () =>
		Effect.gen(function* () {
			const signals: Array<AbortSignal> = [];
			const fetchMock = vi.fn<typeof fetch>();
			fetchMock
				.mockImplementationOnce((_input, init) => pendingResponse(init, signals))
				.mockImplementationOnce((_input, init) => pendingResponse(init, signals))
				.mockResolvedValueOnce(response(200))
				.mockResolvedValueOnce(response(401));
			vi.stubGlobal("fetch", fetchMock);

			const check = yield* checkRemoteEndpointFx(new URL("https://editor.example")).pipe(
				Effect.forkChild,
			);
			yield* Effect.promise(() => Promise.resolve());
			yield* TestClock.adjust(1_499);
			expect(signals).toHaveLength(2);
			expect(signals.every((signal) => signal.aborted)).toBe(false);
			yield* TestClock.adjust(1);
			expect(signals.every((signal) => signal.aborted)).toBe(true);
			yield* TestClock.adjust(249);
			expect(fetchMock).toHaveBeenCalledTimes(2);
			yield* TestClock.adjust(1);
			yield* Fiber.join(check);

			expect(fetchMock).toHaveBeenCalledTimes(4);
		}),
	);

	it.effect("stops after eight attempts and exposes the last response failure", () =>
		Effect.gen(function* () {
			const fetchMock = vi.fn<typeof fetch>();
			for (let attempt = 0; attempt < 7; attempt += 1) {
				fetchMock.mockResolvedValueOnce(response(503)).mockResolvedValueOnce(response(502));
			}
			fetchMock.mockResolvedValueOnce(response(429)).mockResolvedValueOnce(response(403));
			vi.stubGlobal("fetch", fetchMock);

			const check = yield* checkRemoteEndpointFx(new URL("https://editor.example")).pipe(
				Effect.result,
				Effect.forkChild,
			);
			yield* Effect.promise(() => Promise.resolve());
			for (let retry = 0; retry < 7; retry += 1) {
				yield* TestClock.adjust(250);
				yield* Effect.promise(() => Promise.resolve());
			}
			const result = yield* Fiber.join(check);

			expect(fetchMock).toHaveBeenCalledTimes(16);
			expect(Result.isFailure(result)).toBe(true);
			if (Result.isFailure(result)) {
				expect(result.failure).toEqual(
					new Error(
						"Remote MCP public health check failed: metadata returned 429 and MCP returned 403",
					),
				);
			}
		}),
	);

	it.effect("aborts a sibling request when the other request fails", () =>
		Effect.gen(function* () {
			const signals: Array<AbortSignal> = [];
			const fetchMock = vi
				.fn<typeof fetch>()
				.mockRejectedValueOnce(new Error("metadata unavailable"))
				.mockImplementationOnce((_input, init) => pendingResponse(init, signals));
			vi.stubGlobal("fetch", fetchMock);

			const check = yield* checkRemoteEndpointFx(new URL("https://editor.example")).pipe(
				Effect.forkChild,
			);
			yield* Effect.yieldNow;
			yield* Effect.promise(() => Promise.resolve());

			expect(signals).toHaveLength(1);
			expect(signals[0]?.aborted).toBe(true);
			expect(fetchMock).toHaveBeenCalledTimes(2);
			yield* Fiber.interrupt(check);
		}),
	);

	it.effect("aborts both in-flight requests when the caller interrupts", () =>
		Effect.gen(function* () {
			const signals: Array<AbortSignal> = [];
			const fetchMock = vi
				.fn<typeof fetch>()
				.mockImplementation((_input, init) => pendingResponse(init, signals));
			vi.stubGlobal("fetch", fetchMock);

			const check = yield* checkRemoteEndpointFx(new URL("https://editor.example")).pipe(
				Effect.forkChild,
			);
			yield* Effect.yieldNow;
			yield* Effect.promise(() => Promise.resolve());
			yield* Fiber.interrupt(check);

			expect(signals).toHaveLength(2);
			expect(signals.every((signal) => signal.aborted)).toBe(true);
			expect(fetchMock).toHaveBeenCalledTimes(2);
		}),
	);
});

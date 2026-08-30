import { scheduleTask } from "@effect/atom-react";
import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createRendererLifecycleFx } from "~/application-runtime/fx/createRendererLifecycleFx";
import {
	readRendererLifecycleFx,
	RendererLifecycleOwnerAtom,
} from "~/application-runtime/fx/readRendererLifecycleFx";

const registries: AtomRegistry.AtomRegistry[] = [];

const createRegistry = () => {
	const registry = AtomRegistry.make({
		defaultIdleTTL: 400,
		scheduleTask,
	});
	registries.push(registry);
	return registry;
};

afterEach(() => {
	for (const registry of registries.splice(0)) registry.dispose();
});

describe("Renderer lifecycle", () => {
	it("rejects reads before installation and then exposes the exact installed owner", async () => {
		const registry = createRegistry();
		const forceClose = vi.fn();
		const requestClose = vi.fn(() => Promise.resolve());
		const waitUntilVisible = vi.fn(() => Promise.resolve(42));
		const lifecycle = Effect.runSync(
			createRendererLifecycleFx({
				forceClose,
				requestClose,
				waitUntilVisible,
			}),
		);
		const provideRegistry = Effect.provideService(AtomRegistry.AtomRegistry, registry);

		const unavailable = await Effect.runPromise(
			Effect.flip(readRendererLifecycleFx()).pipe(provideRegistry),
		);
		expect(unavailable).toMatchObject({
			_tag: "RendererLifecycleUnavailableError",
		});
		registry.set(RendererLifecycleOwnerAtom, lifecycle);
		expect(await Effect.runPromise(readRendererLifecycleFx().pipe(provideRegistry))).toBe(
			lifecycle,
		);
		await Effect.runPromise(lifecycle.forceCloseFx);
		await Effect.runPromise(lifecycle.requestCloseFx);
		expect(await Effect.runPromise(lifecycle.waitUntilVisibleFx)).toBe(42);
		expect(forceClose).toHaveBeenCalledOnce();
		expect(requestClose).toHaveBeenCalledOnce();
		expect(waitUntilVisible).toHaveBeenCalledOnce();
	});

	it("preserves the failing native operation and cause", async () => {
		const causes = {
			forceClose: new Error("force failed"),
			requestClose: new Error("request failed"),
			waitUntilVisible: new Error("visibility failed"),
		};
		const lifecycle = Effect.runSync(
			createRendererLifecycleFx({
				forceClose: () => {
					throw causes.forceClose;
				},
				requestClose: () => Promise.reject(causes.requestClose),
				waitUntilVisible: () => Promise.reject(causes.waitUntilVisible),
			}),
		);

		const errors = await Promise.all([
			Effect.runPromise(Effect.flip(lifecycle.forceCloseFx)),
			Effect.runPromise(Effect.flip(lifecycle.requestCloseFx)),
			Effect.runPromise(Effect.flip(lifecycle.waitUntilVisibleFx)),
		]);
		expect(errors).toEqual([
			expect.objectContaining({
				_tag: "RendererLifecycleError",
				cause: causes.forceClose,
				operation: "force-close",
			}),
			expect.objectContaining({
				_tag: "RendererLifecycleError",
				cause: causes.requestClose,
				operation: "request-close",
			}),
			expect.objectContaining({
				_tag: "RendererLifecycleError",
				cause: causes.waitUntilVisible,
				operation: "wait-until-visible",
			}),
		]);
	});
});

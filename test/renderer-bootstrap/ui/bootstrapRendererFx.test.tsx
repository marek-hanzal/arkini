// @vitest-environment jsdom

import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SerakkiElectronApi } from "~electron/contract/SerakkiElectronApi";
import { RendererAtomRegistry } from "~/application-runtime/atom/RendererAtomRegistry";
import { bootstrapRendererFx } from "~/renderer-bootstrap/ui/bootstrapRendererFx";

const { createRootFn } = vi.hoisted(() => ({
	createRootFn: vi.fn(),
}));

vi.mock("react-dom/client", () => ({
	createRoot: createRootFn,
}));

const installLifecycleFn = (forceCloseFn: () => void) => {
	Object.defineProperty(window, "serakki", {
		configurable: true,
		value: {
			lifecycle: {
				forceCloseFn,
			},
		} as unknown as SerakkiElectronApi.Api,
	});
};

const runBootstrapFx = () =>
	Effect.runPromise(
		bootstrapRendererFx().pipe(
			Effect.provideService(AtomRegistry.AtomRegistry, RendererAtomRegistry),
		),
	);

beforeEach(() => {
	document.body.replaceChildren();
	createRootFn.mockReset();
	vi.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("bootstrapRendererFx", () => {
	it("closes the hidden window when the renderer root is missing", async () => {
		const forceCloseFn = vi.fn();
		installLifecycleFn(forceCloseFn);

		await expect(runBootstrapFx()).rejects.toThrow("Serakki root element is missing.");

		expect(createRootFn).not.toHaveBeenCalled();
		expect(forceCloseFn).toHaveBeenCalledOnce();
	});

	it("closes the hidden window when React cannot create its root", async () => {
		const forceCloseFn = vi.fn();
		const failure = new Error("React root failed");
		installLifecycleFn(forceCloseFn);
		document.body.innerHTML = '<div id="root"></div>';
		createRootFn.mockImplementation(() => {
			throw failure;
		});

		await expect(runBootstrapFx()).rejects.toBe(failure);

		expect(createRootFn).toHaveBeenCalledOnce();
		expect(forceCloseFn).toHaveBeenCalledOnce();
	});
});

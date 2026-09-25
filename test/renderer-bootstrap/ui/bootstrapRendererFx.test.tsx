// @vitest-environment jsdom

import { Effect } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SerakkiElectronApi } from "~electron/contract/SerakkiElectronApi";
import { RendererAtomRegistry } from "~/application-runtime/atom/RendererAtomRegistry";
import { GraphicsUnavailablePage } from "~/application-shell/ui/GraphicsUnavailablePage";
import { bootstrapRendererFx } from "~/renderer-bootstrap/ui/bootstrapRendererFx";

const { createRootFn, readGraphicsAvailabilityFn, bootstrapTranslationFn, bootstrapCatalogFn } =
	vi.hoisted(() => ({
		createRootFn: vi.fn(),
		readGraphicsAvailabilityFn: vi.fn(),
		bootstrapTranslationFn: vi.fn(),
		bootstrapCatalogFn: vi.fn(),
	}));

vi.mock("react-dom/client", () => ({
	createRoot: createRootFn,
}));
vi.mock("~/tile-rendering/fx/readGraphicsAvailabilityFx", () => ({
	readGraphicsAvailabilityFx: readGraphicsAvailabilityFn,
}));
vi.mock("~/translation/fx/bootstrapTranslationFx", () => ({
	bootstrapTranslationFx: bootstrapTranslationFn,
}));
vi.mock("~/serapack-catalog/fx/bootstrapSerapackCatalogFx", () => ({
	bootstrapSerapackCatalogFx: bootstrapCatalogFn,
}));

const installLifecycleFn = (forceCloseFn: () => void) => {
	Object.defineProperty(window, "serakki", {
		configurable: true,
		value: {
			lifecycle: {
				forceCloseFn,
			},
			localization: {
				readPreferredLanguagesFn: vi.fn(),
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
	readGraphicsAvailabilityFn.mockReset();
	bootstrapTranslationFn.mockReset();
	bootstrapCatalogFn.mockReset();
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

	it("shows a standalone alert before loading Launcher when no GPU renderer is available", async () => {
		const forceCloseFn = vi.fn();
		const renderFn = vi.fn();
		installLifecycleFn(forceCloseFn);
		document.body.innerHTML = '<div id="root"></div>';
		createRootFn.mockReturnValue({
			render: renderFn,
		});
		bootstrapTranslationFn.mockReturnValue(
			Effect.succeed({
				locale: "en",
				translator: {},
			}),
		);
		readGraphicsAvailabilityFn.mockReturnValue(Effect.succeed(false));

		await runBootstrapFx();

		expect(renderFn).toHaveBeenCalledOnce();
		expect(renderFn.mock.calls[0]?.[0].type).toBe(GraphicsUnavailablePage);
		expect(bootstrapCatalogFn).not.toHaveBeenCalled();
		expect(forceCloseFn).not.toHaveBeenCalled();
	});
});

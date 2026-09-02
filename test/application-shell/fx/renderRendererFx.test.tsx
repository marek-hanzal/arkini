// @vitest-environment jsdom

import { Effect } from "effect";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ArkiniElectronApi } from "~electron/contract/ArkiniElectronApi";
import { renderRendererFx } from "~/application-shell/ui/renderRendererFx";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const writeApplicationLog = vi.fn(() => Promise.resolve());

beforeEach(() => {
	vi.spyOn(console, "error").mockImplementation(() => undefined);
	writeApplicationLog.mockClear();
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			diagnostics: {
				openDirectoryFn: () => Promise.resolve(),
				writeFn: () => Promise.resolve(),
				writeApplicationFn: writeApplicationLog,
			},
		} as unknown as ArkiniElectronApi.Api,
	});
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

describe("renderRendererFx", () => {
	it("renders the fatal surface when preferred-language bootstrap rejects", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const failure = new Error("preferred languages unavailable");
		const readPreferredLanguagesFn = () => Promise.reject(failure);

		await act(async () => {
			await Effect.runPromise(
				renderRendererFx({
					onCloseFn: vi.fn(),
					root,
					viewFx: Effect.promise(readPreferredLanguagesFn).pipe(
						Effect.as(<div data-ui="ReadyRenderer" />),
					),
				}),
			);
		});

		expect(container.querySelector('[data-ui="RootFatalErrorPage"]')).not.toBeNull();
		expect(container.textContent).toContain("Something critical failed");
		expect(container.querySelector('[data-ui="ReadyRenderer"]')).toBeNull();
		expect(writeApplicationLog).toHaveBeenCalledWith({
			level: "fatal",
			message: "Renderer entered the fatal boundary",
			body: expect.stringContaining("preferred languages unavailable"),
		});
	});
});

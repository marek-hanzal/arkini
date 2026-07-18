// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ArkiniDesktopApi } from "../../../desktop/ArkiniDesktopApi";
import type { ActionLoadingControl } from "~/ui/loading/ActionLoadingControl";
import { ActionLoadingProvider } from "~/ui/loading/ActionLoadingProvider";
import { useActionLoading } from "~/ui/loading/useActionLoading";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const beforeCloseReadyListeners = new Set<() => Promise<void>>();

const deferred = () => {
	let resolve!: () => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<void>((nextResolve, nextReject) => {
		resolve = nextResolve;
		reject = nextReject;
	});
	return {
		promise,
		reject,
		resolve,
	};
};

let control: ActionLoadingControl.Type | undefined;

const Probe = () => {
	control = useActionLoading();
	return createElement("div", {
		"data-ui": "LoadingProbe",
	});
};

const renderProvider = async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(
				ActionLoadingProvider,
				{
					completedHoldMs: 0,
					minimumDurationMs: 0,
				},
				createElement(Probe),
			),
		);
	});
	if (control === undefined) throw new Error("Expected loading control.");
	return {
		container,
		control,
	};
};

const flushLoadingTimers = async () => {
	await act(async () => {
		await vi.runAllTimersAsync();
		await Promise.resolve();
	});
};

beforeEach(() => {
	vi.useFakeTimers();
	control = undefined;
	beforeCloseReadyListeners.clear();
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		value: vi.fn(() => ({
			matches: true,
		})),
	});
	Object.defineProperty(document, "getAnimations", {
		configurable: true,
		value: vi.fn(() => []),
	});
	Object.defineProperty(document, "startViewTransition", {
		configurable: true,
		value: vi.fn((update: () => void) => {
			update();
			return {
				finished: Promise.resolve(),
				ready: Promise.resolve(),
				skipTransition: vi.fn(),
				updateCallbackDone: Promise.resolve(),
			} as unknown as ViewTransition;
		}),
	});
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			lifecycle: {
				onBeforeCloseReady: (listener: () => Promise<void>) => {
					beforeCloseReadyListeners.add(listener);
					return () => beforeCloseReadyListeners.delete(listener);
				},
			},
		} as unknown as ArkiniDesktopApi.Api,
	});
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	vi.useRealTimers();
	vi.restoreAllMocks();
	document.body.replaceChildren();
	Reflect.deleteProperty(document, "startViewTransition");
});

describe("ActionLoadingProvider", () => {
	it("presents one real action and reveals the target through a local View Transition", async () => {
		const action = deferred();
		const { container, control: loading } = await renderProvider();
		let result!: Promise<void>;
		await act(async () => {
			result = loading.run({
				action: () => action.promise,
				key: "test:normal",
				label: "Running action…",
			});
			await Promise.resolve();
		});

		expect(container.querySelector('[data-ui="ActionLoadingOverlay"]')).not.toBeNull();
		expect(container.querySelector('[data-action-loading-active="true"]')).not.toBeNull();

		await act(async () => {
			action.resolve();
			await action.promise;
		});
		await flushLoadingTimers();
		await result;

		expect(document.startViewTransition).toHaveBeenCalledOnce();
		expect(container.querySelector('[data-ui="ActionLoadingOverlay"]')).toBeNull();
	});

	it("deduplicates repeated requests with the same action key", async () => {
		const action = deferred();
		const run = vi.fn(() => action.promise);
		const { control: loading } = await renderProvider();
		let first!: Promise<void>;
		let second!: Promise<void>;
		await act(async () => {
			first = loading.run({
				action: run,
				key: "test:dedupe",
				label: "Running once…",
			});
			second = loading.run({
				action: run,
				key: "test:dedupe",
				label: "Running once…",
			});
			await Promise.resolve();
		});
		expect(first).toBe(second);
		expect(run).toHaveBeenCalledOnce();

		await act(async () => action.resolve());
		await flushLoadingTimers();
		await first;
	});

	it("holds native close readiness until successful completion is visible", async () => {
		const closeRequest = deferred();
		const requestClose = vi.fn(() => closeRequest.promise);
		const { container, control: loading } = await renderProvider();
		let result!: Promise<void>;
		await act(async () => {
			result = loading.runNativeClose({
				action: requestClose,
				key: "test:native-close",
				label: "Saving and exiting…",
			});
			await Promise.resolve();
		});
		expect(requestClose).toHaveBeenCalledOnce();
		expect(container.querySelector('[data-ui="ActionLoadingOverlay"]')).not.toBeNull();
		expect(beforeCloseReadyListeners).toHaveLength(1);

		let readyResolved = false;
		const ready = Promise.all(
			Array.from(beforeCloseReadyListeners, (listener) => listener()),
		).then(() => {
			readyResolved = true;
		});
		await act(async () => Promise.resolve());
		expect(readyResolved).toBe(false);

		await flushLoadingTimers();
		await ready;
		expect(readyResolved).toBe(true);
		expect(container.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow")).toBe(
			"100",
		);
		expect(container.querySelector('[data-ui="ActionLoadingOverlay"]')).not.toBeNull();

		await act(async () => closeRequest.resolve());
		await result;
	});

	it("reveals authoritative failure UI without leaving the loader mounted", async () => {
		const failure = new Error("action failed");
		const { container, control: loading } = await renderProvider();
		let result!: Promise<unknown>;
		await act(async () => {
			result = loading
				.run({
					action: () => Promise.reject(failure),
					key: "test:failure",
					label: "Failing action…",
				})
				.catch((error) => error);
			await Promise.resolve();
		});
		await flushLoadingTimers();
		expect(await result).toBe(failure);
		expect(container.querySelector('[data-ui="ActionLoadingOverlay"]')).toBeNull();
	});
});

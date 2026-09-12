// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCopyButtonController } from "~/ui/ui/useCopyButtonController";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root;
let container: HTMLDivElement;
let controller: useCopyButtonController.Output;
const writeTextFn = vi.fn<(value: string) => Promise<void>>();

const Probe = ({ value }: { readonly value: string }) => {
	controller = useCopyButtonController({
		value,
	});
	return null;
};

const renderFn = async (value: string) => {
	await act(async () => root.render(<Probe value={value} />));
};

beforeEach(() => {
	vi.useFakeTimers();
	writeTextFn.mockReset().mockResolvedValue(undefined);
	vi.stubGlobal("arkini", {
		clipboard: {
			writeTextFn,
		},
	});
	container = document.createElement("div");
	root = createRoot(container);
});

afterEach(async () => {
	await act(async () => root.unmount());
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe("useCopyButtonController", () => {
	it("restarts the three-second confirmation after another successful copy", async () => {
		await renderFn("item-id");
		await act(async () => controller.copyFn());
		expect(writeTextFn).toHaveBeenLastCalledWith("item-id");
		expect(controller.copied).toBe(true);
		await act(async () => vi.advanceTimersByTime(2_000));
		await act(async () => controller.copyFn());
		await act(async () => vi.advanceTimersByTime(2_999));
		expect(controller.copied).toBe(true);
		await act(async () => vi.advanceTimersByTime(1));
		expect(controller.copied).toBe(false);
	});

	it("ignores an old write completing after a newer copy failed and permits retry", async () => {
		let resolveOldFn: () => void = () => undefined;
		writeTextFn.mockImplementationOnce(
			() =>
				new Promise<void>((resolveFn) => {
					resolveOldFn = resolveFn;
				}),
		);
		await renderFn("item-id");
		let oldWrite: Promise<void> | undefined;
		await act(async () => {
			oldWrite = controller.copyFn();
		});
		expect(controller.copied).toBe(false);
		writeTextFn.mockRejectedValueOnce(new Error("Clipboard unavailable"));
		await act(async () => controller.copyFn());
		await act(async () => {
			resolveOldFn();
			await oldWrite;
		});
		expect(controller.copied).toBe(false);
		expect(controller.error).toBe("Clipboard unavailable");
		expect(vi.getTimerCount()).toBe(0);
		await act(async () => controller.copyFn());
		expect(controller.copied).toBe(true);
		expect(controller.error).toBeUndefined();
	});

	it("clears feedback on value change and ignores writes settling after replacement or unmount", async () => {
		await renderFn("item-id");
		await act(async () => controller.copyFn());
		await renderFn("item-uid");
		expect(controller.copied).toBe(false);
		expect(vi.getTimerCount()).toBe(0);
		let resolveWriteFn: () => void = () => undefined;
		writeTextFn.mockImplementation(
			() =>
				new Promise<void>((resolveFn) => {
					resolveWriteFn = resolveFn;
				}),
		);
		let pending: Promise<void> | undefined;
		await act(async () => {
			pending = controller.copyFn();
		});
		expect(writeTextFn).toHaveBeenLastCalledWith("item-uid");
		await renderFn("successor-uid");
		await act(async () => {
			resolveWriteFn();
			await pending;
		});
		expect(controller.copied).toBe(false);
		expect(vi.getTimerCount()).toBe(0);
		await act(async () => {
			pending = controller.copyFn();
		});
		await act(async () => root.render(null));
		await act(async () => {
			resolveWriteFn();
			await pending;
		});
		expect(vi.getTimerCount()).toBe(0);
	});
});

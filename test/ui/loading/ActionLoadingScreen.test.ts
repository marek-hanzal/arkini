// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	ActionLoadingScreen,
	defaultLoadingMinimumDurationMs,
} from "~/ui/loading/ActionLoadingScreen";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

const renderScreen = async (completed = false) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(ActionLoadingScreen, {
				completed,
				label: "Loading test…",
			}),
		);
	});
	return {
		container,
		render: async (nextCompleted: boolean) => {
			await act(async () => {
				root.render(
					createElement(ActionLoadingScreen, {
						completed: nextCompleted,
						label: "Loading test…",
					}),
				);
			});
		},
	};
};

const progressValue = (container: ParentNode) =>
	Number(container.querySelector('[role="progressbar"]')?.getAttribute("aria-valuenow"));

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	vi.useRealTimers();
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

describe("ActionLoadingScreen", () => {
	it("renders one native route surface and advances without claiming completion", async () => {
		const { container } = await renderScreen();
		expect(progressValue(container)).toBe(12);

		await act(async () => vi.advanceTimersByTime(defaultLoadingMinimumDurationMs));
		expect(progressValue(container)).toBe(94);
	});

	it("keeps the exit frame full after the route loader completes", async () => {
		const { container, render } = await renderScreen();

		await act(async () => vi.advanceTimersByTime(defaultLoadingMinimumDurationMs));
		expect(progressValue(container)).toBe(94);

		await render(true);
		expect(progressValue(container)).toBe(100);

		await act(async () => vi.advanceTimersByTime(defaultLoadingMinimumDurationMs));
		expect(progressValue(container)).toBe(100);
	});
});

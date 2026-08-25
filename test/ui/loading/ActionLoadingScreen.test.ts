// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActionLoadingScreen } from "~/ui/loading/ActionLoadingScreen";
import { defaultLoadingMinimumDurationMs } from "~/ui/loading/defaultLoadingMinimumDurationMs";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

const renderScreen = async (completed = false, durationMs?: number) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			createElement(ActionLoadingScreen, {
				completed,
				durationMs,
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
						durationMs,
						label: "Loading test…",
					}),
				);
			});
		},
	};
};

const progressValue = (container: ParentNode) => {
	const fill = container.querySelector<HTMLElement>(
		'[data-ui="ActionLoadingScreenProgressFill"]',
	);
	if (fill === null) throw new Error("Missing Action loading progress fill.");
	const match = /^scaleX\(([^)]+)\)$/.exec(fill.style.transform);
	if (match === null) throw new Error("Missing Action loading progress transform.");
	return Math.round(Number(match[1]) * 100);
};

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

	it("can compress the same progress curve for an in-place action", async () => {
		const durationMs = 1_000;
		const { container } = await renderScreen(false, durationMs);

		await act(async () => vi.advanceTimersByTime(durationMs));

		expect(progressValue(container)).toBe(94);
	});
});

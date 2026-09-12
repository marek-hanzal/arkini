// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import { useDebouncedSearchQuery } from "~/ui/ui/useDebouncedSearchQuery";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	vi.useRealTimers();
	document.body.replaceChildren();
});

const Harness = ({ query }: { readonly query: string }) => (
	<output>{useDebouncedSearchQuery(query)}</output>
);

it("settles only the latest search and cancels pending text on clear and unmount", async () => {
	vi.useFakeTimers();
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	const renderFn = async (query: string) => {
		await act(async () => root.render(<Harness query={query} />));
	};
	const advanceFn = async (duration: number) => {
		await act(async () => vi.advanceTimersByTime(duration));
	};

	await renderFn("initial route query");
	expect(container.textContent).toBe("initial route query");
	await renderFn("wo");
	await advanceFn(200);
	await renderFn("wood");
	await advanceFn(249);
	expect(container.textContent).toBe("initial route query");
	await advanceFn(1);
	expect(container.textContent).toBe("wood");

	await renderFn("abandoned");
	await advanceFn(100);
	await renderFn("");
	expect(container.textContent).toBe("");
	await advanceFn(250);
	expect(container.textContent).toBe("");

	await renderFn("leave this page");
	await act(async () => root.render(null));
	expect(vi.getTimerCount()).toBe(0);
	await renderFn("new page query");
	expect(container.textContent).toBe("new page query");
});

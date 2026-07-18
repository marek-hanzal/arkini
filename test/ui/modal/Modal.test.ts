// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ResponsiveModal } from "~/ui/modal/ResponsiveModal";
import { ViewportModal } from "~/ui/modal/ViewportModal";

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
	document.body.replaceChildren();
});

const renderModal = async (component: ReturnType<typeof createElement>) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => root.render(component));
	return container;
};

describe("modal presentation shells", () => {
	it("renders a labelled content-sized modal boundary", async () => {
		const container = await renderModal(
			createElement(
				ResponsiveModal,
				{
					labelledBy: "responsive-title",
					viewTransitionName: "responsive-modal",
				},
				createElement(
					"h2",
					{
						id: "responsive-title",
					},
					"Responsive",
				),
			),
		);

		const panel = container.querySelector('[data-ui="ResponsiveModal"]');
		expect(panel?.getAttribute("role")).toBe("dialog");
		expect(panel?.getAttribute("aria-labelledby")).toBe("responsive-title");
		expect((panel as HTMLElement | null)?.style.viewTransitionName).toBe("responsive-modal");
	});

	it("renders a labelled viewport-sized modal boundary", async () => {
		const container = await renderModal(
			createElement(
				ViewportModal,
				{
					labelledBy: "viewport-title",
					viewTransitionName: "viewport-modal",
				},
				createElement(
					"h2",
					{
						id: "viewport-title",
					},
					"Viewport",
				),
			),
		);

		const panel = container.querySelector('[data-ui="ViewportModal"]');
		expect(panel?.getAttribute("role")).toBe("dialog");
		expect(panel?.getAttribute("aria-labelledby")).toBe("viewport-title");
		expect((panel as HTMLElement | null)?.style.viewTransitionName).toBe("viewport-modal");
	});
});

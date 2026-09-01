// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/authoring-form/ui/EditorItemThumbnail", () => ({
	EditorItemThumbnail: () =>
		createElement("span", {
			"data-ui": "EditorItemThumbnail",
		}),
}));

import { ProjectStartGrid } from "~/project-authoring/ui/ProjectStartGrid";
import { boardSpaceProject } from "~test/project-authoring/support/BoardSpaceProject";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	vi.restoreAllMocks();
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

describe("ProjectStartGrid", () => {
	it("keeps detail mode independent from edit context and drag lifecycle", async () => {
		const addWindowListenerFn = vi.spyOn(window, "addEventListener");
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				<ProjectStartGrid
					cells={[
						{
							itemId: "water",
							quantity: 2,
							x: 0,
							y: 0,
						},
					]}
					height={2}
					items={boardSpaceProject.config.items}
					mode="detail"
					width={2}
				/>,
			);
		});

		expect(
			container
				.querySelector('[data-ui="EditorProjectStartGrid"]')
				?.getAttribute("data-mode"),
		).toBe("detail");
		expect(container.querySelectorAll('[data-ui="EditorProjectStartGridSlot"]')).toHaveLength(
			4,
		);
		expect(container.querySelector('[data-ui="EditorItemThumbnail"]')).not.toBeNull();
		expect(
			addWindowListenerFn.mock.calls.filter(([type]) =>
				[
					"blur",
					"pointercancel",
					"pointermove",
					"pointerup",
				].includes(type),
			),
		).toHaveLength(0);
	});
});

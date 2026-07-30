// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorItemThumbnail } from "~/ui/item/editor/EditorItemThumbnail";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("~/ui/resource/editor/useEditorResourceUrl", () => ({
	useEditorResourceUrl: (resourceId?: string) =>
		resourceId === undefined ? undefined : `resource:${resourceId}`,
}));

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

describe("EditorItemThumbnail", () => {
	it("uses the canonical top-left and bottom-right composition for two resources", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(EditorItemThumbnail, {
					resourceIds: [
						"base",
						"overlay",
					],
				}),
			);
		});

		const images = [
			...container.querySelectorAll("img"),
		];
		expect(images).toHaveLength(2);
		expect(images[0]).toMatchObject({
			src: "resource:base",
		});
		expect(images[0]?.className).toContain("top-0 left-0 size-3/4");
		expect(images[1]).toMatchObject({
			src: "resource:overlay",
		});
		expect(images[1]?.className).toContain("right-0 bottom-0 z-10 size-3/4");
	});
});

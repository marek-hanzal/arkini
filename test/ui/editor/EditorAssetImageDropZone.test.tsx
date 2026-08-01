// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorAssetImageDropZone } from "~/ui/resource/editor/EditorAssetImageDropZone";

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
	vi.restoreAllMocks();
});

describe("EditorAssetImageDropZone", () => {
	it("replaces the canonical preview with the selected local PNG", async () => {
		const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:selected");
		const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const render = (file?: File) =>
			root.render(
				createElement(EditorAssetImageDropZone, {
					currentUrl: "blob:canonical",
					file,
					onFile: vi.fn(),
				}),
			);

		await act(async () => render());
		expect(container.querySelector("img")?.src).toBe("blob:canonical");

		const file = new File(
			[
				"png",
			],
			"replacement.png",
			{
				type: "image/png",
			},
		);
		await act(async () => render(file));
		expect(createObjectUrl).toHaveBeenCalledWith(file);
		expect(container.querySelector("img")?.src).toBe("blob:selected");
		expect(container.textContent).toContain("replacement.png");

		await act(async () => root.unmount());
		roots.pop();
		expect(revokeObjectUrl).toHaveBeenCalledWith("blob:selected");
	});
});

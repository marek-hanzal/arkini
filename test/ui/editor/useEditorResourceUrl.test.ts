// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	EditorResourceUrlProvider,
	useEditorResourceUrl,
} from "~/ui/resource/editor/useEditorResourceUrl";

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

const UrlProbe = ({ resourceId }: { readonly resourceId: string }) =>
	createElement("output", null, useEditorResourceUrl(resourceId));

describe("EditorResourceUrlProvider", () => {
	it("shares one URL per resource and revokes the snapshot on replacement", async () => {
		const createObjectUrl = vi
			.spyOn(URL, "createObjectURL")
			.mockReturnValueOnce("blob:first")
			.mockReturnValueOnce("blob:second");
		const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
		const firstResources = [
			{
				id: "hero",
				mime: "image/png",
				bytes: new Uint8Array([
					1,
				]),
			},
		];
		const secondResources = [
			{
				id: "hero",
				mime: "image/png",
				bytes: new Uint8Array([
					2,
				]),
			},
		];
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const render = (resources: typeof firstResources) =>
			root.render(
				createElement(
					EditorResourceUrlProvider,
					{
						resources,
					},
					createElement(UrlProbe, {
						resourceId: "hero",
					}),
					createElement(UrlProbe, {
						resourceId: "hero",
					}),
				),
			);

		await act(async () => render(firstResources));
		expect(createObjectUrl).toHaveBeenCalledTimes(1);
		expect(container.textContent).toBe("blob:firstblob:first");

		await act(async () =>
			render([
				{
					...firstResources[0],
					bytes: firstResources[0]?.bytes.slice() ?? new Uint8Array(),
				},
			]),
		);
		expect(createObjectUrl).toHaveBeenCalledTimes(1);
		expect(revokeObjectUrl).not.toHaveBeenCalled();
		expect(container.textContent).toBe("blob:firstblob:first");

		await act(async () => render(secondResources));
		expect(createObjectUrl).toHaveBeenCalledTimes(2);
		expect(revokeObjectUrl).toHaveBeenCalledWith("blob:first");
		expect(container.textContent).toBe("blob:secondblob:second");
	});
});

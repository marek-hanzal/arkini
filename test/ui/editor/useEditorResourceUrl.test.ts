// @vitest-environment jsdom

import { act, createElement, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	useEditorResourceUrl,
	useEditorResourceUrls,
} from "~/ui/resource/editor/useEditorResourceUrl";
import { EditorResourceUrlProvider } from "~/ui/resource/editor/EditorResourceUrlProvider";
import type { ResourceSchema } from "~/game-config/resource/schema/ResourceSchema";

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

const UrlMapProbe = ({ resourceIds }: { readonly resourceIds: ReadonlyArray<string> }) => {
	const stableIds = useMemo(
		() => resourceIds,
		[
			resourceIds,
		],
	);
	return createElement(
		"output",
		null,
		[
			...useEditorResourceUrls(stableIds).entries(),
		]
			.map(([id, url]) => `${id}:${url}`)
			.join("|"),
	);
};

describe("EditorResourceUrlProvider", () => {
	it("allocates URLs only for mounted consumers and shares one active URL per resource", async () => {
		const createObjectUrl = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:hero");
		const revokeObjectUrl = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
		const resources = [
			{
				id: "hero",
				mime: "image/png",
				bytes: new Uint8Array([
					1,
				]),
			},
			{
				id: "unused",
				mime: "image/png",
				bytes: new Uint8Array([
					2,
				]),
			},
		] satisfies ReadonlyArray<ResourceSchema.Type>;
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () =>
			root.render(
				createElement(
					EditorResourceUrlProvider,
					{
						resources,
					},
					createElement("span", null, "No preview"),
				),
			),
		);
		expect(createObjectUrl).not.toHaveBeenCalled();

		await act(async () =>
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
			),
		);
		expect(createObjectUrl).toHaveBeenCalledTimes(1);
		expect(container.textContent).toBe("blob:heroblob:hero");
		expect(revokeObjectUrl).not.toHaveBeenCalled();

		await act(async () =>
			root.render(
				createElement(
					EditorResourceUrlProvider,
					{
						resources,
					},
					createElement("span", null, "No preview"),
				),
			),
		);
		expect(revokeObjectUrl).toHaveBeenCalledTimes(1);
		expect(revokeObjectUrl).toHaveBeenCalledWith("blob:hero");
	});

	it("reuses byte-equal active URLs and replaces only the changed requested resource", async () => {
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
			{
				id: "unused",
				mime: "image/png",
				bytes: new Uint8Array([
					9,
					9,
					9,
				]),
			},
		] satisfies ReadonlyArray<ResourceSchema.Type>;
		const secondResources = [
			{
				id: "hero",
				mime: "image/png",
				bytes: new Uint8Array([
					2,
				]),
			},
			firstResources[1]!,
		] satisfies ReadonlyArray<ResourceSchema.Type>;
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
				),
			);

		await act(async () => render(firstResources));
		expect(createObjectUrl).toHaveBeenCalledTimes(1);
		expect(container.textContent).toBe("blob:first");

		await act(async () =>
			render([
				{
					...firstResources[0]!,
					bytes: firstResources[0]!.bytes.slice(),
				},
				{
					...firstResources[1]!,
					bytes: new Uint8Array(1024 * 1024),
				},
			]),
		);
		expect(createObjectUrl).toHaveBeenCalledTimes(1);
		expect(revokeObjectUrl).not.toHaveBeenCalled();
		expect(container.textContent).toBe("blob:first");

		await act(async () => render(secondResources));
		expect(createObjectUrl).toHaveBeenCalledTimes(2);
		expect(revokeObjectUrl).toHaveBeenCalledWith("blob:first");
		expect(container.textContent).toBe("blob:second");
	});

	it("acquires only the explicit URL set requested by a multi-resource consumer", async () => {
		const createObjectUrl = vi
			.spyOn(URL, "createObjectURL")
			.mockReturnValueOnce("blob:hero")
			.mockReturnValueOnce("blob:overlay");
		vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
		const resourceIds = [
			"hero",
			"overlay",
		] as const;
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () =>
			root.render(
				createElement(
					EditorResourceUrlProvider,
					{
						resources: [
							{
								id: "hero",
								mime: "image/png",
								bytes: Uint8Array.of(1),
							},
							{
								id: "overlay",
								mime: "image/png",
								bytes: Uint8Array.of(2),
							},
							{
								id: "unused",
								mime: "image/png",
								bytes: Uint8Array.of(3),
							},
						],
					},
					createElement(UrlMapProbe, {
						resourceIds,
					}),
				),
			),
		);

		expect(createObjectUrl).toHaveBeenCalledTimes(2);
		expect(container.textContent).toBe("hero:blob:hero|overlay:blob:overlay");
	});
});

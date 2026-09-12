// @vitest-environment jsdom

import { act, createElement, useMemo } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	ProjectResourceUrlProvider,
	useResourceUrl,
	useResourceUrls,
} from "~/authoring-session/ui/ResourceUrlSession";
import type { Project } from "~/project-authoring/type/Project";
import { readProjectResourceUrlFn } from "~/project-authoring/fn/readProjectResourceUrlFn";

const state = vi.hoisted(() => ({
	projectId: "project-one",
	resources: [] as Project["resources"],
}));

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		resources: state.resources,
		projectId: state.projectId,
	}),
}));

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
	state.resources = [];
	state.projectId = "project-one";
	vi.restoreAllMocks();
});

const UrlProbe = ({ resourceId }: { readonly resourceId: string }) =>
	createElement("output", null, useResourceUrl(resourceId));

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
			...useResourceUrls(stableIds).entries(),
		]
			.map(([id, url]) => `${id}:${url}`)
			.join("|"),
	);
};

const resourceFn = (id: string, version = "1"): Project.Resource => ({
	id,
	version,
	mime: "image/png",
	size: 1024,
});
const urlFn = (resourceId: string, version = "1", projectId = "project-one") =>
	readProjectResourceUrlFn({
		projectId,
		resourceId,
		version,
	});

const mountFn = () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	return {
		container,
		renderFn: (resourceIds: ReadonlyArray<string>) =>
			root.render(
				createElement(
					ProjectResourceUrlProvider,
					null,
					...resourceIds.map((resourceId) =>
						createElement(UrlProbe, {
							key: resourceId,
							resourceId,
						}),
					),
				),
			),
	};
};

describe("ProjectResourceUrlProvider", () => {
	it("shares browser-cache URLs across unmounts without loading or copying image bodies", async () => {
		const createObjectUrl = vi.spyOn(URL, "createObjectURL");
		const fetchFn = vi.spyOn(globalThis, "fetch");
		state.resources = [
			resourceFn("hero"),
			resourceFn("unused"),
		];
		const { container, renderFn } = mountFn();
		await act(async () =>
			renderFn([
				"hero",
			]),
		);
		const firstUrl = container.textContent;
		expect(firstUrl).toBe(urlFn("hero"));
		await act(async () => renderFn([]));
		await act(async () =>
			renderFn([
				"hero",
			]),
		);
		expect(container.textContent).toBe(firstUrl);
		expect(createObjectUrl).not.toHaveBeenCalled();
		expect(fetchFn).not.toHaveBeenCalled();
	});

	it("invalidates only a replaced asset and clears removed resources from mounted consumers", async () => {
		const { container, renderFn } = mountFn();
		state.resources = [
			resourceFn("hero"),
			resourceFn("overlay"),
		];
		await act(async () =>
			renderFn([
				"hero",
				"overlay",
			]),
		);
		expect(container.textContent).toBe(urlFn("hero") + urlFn("overlay"));
		state.resources = [
			resourceFn("hero", "2"),
			resourceFn("overlay"),
		];
		await act(async () =>
			renderFn([
				"hero",
				"overlay",
			]),
		);
		expect(container.textContent).toBe(urlFn("hero", "2") + urlFn("overlay"));
		state.resources = [
			resourceFn("overlay"),
		];
		await act(async () =>
			renderFn([
				"hero",
				"overlay",
			]),
		);
		expect(container.textContent).toBe(urlFn("overlay"));
	});

	it("resolves only requested metadata and never reuses another project's asset identity", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const resourceIds = [
			"hero",
			"overlay",
			"missing",
		];
		state.resources = [
			resourceFn("hero"),
			resourceFn("overlay"),
			resourceFn("unused"),
		];
		const renderFn = () =>
			root.render(
				createElement(
					ProjectResourceUrlProvider,
					null,
					createElement(UrlMapProbe, {
						resourceIds,
					}),
				),
			);
		await act(async () => renderFn());
		expect(container.textContent).toBe(`hero:${urlFn("hero")}|overlay:${urlFn("overlay")}`);
		state.projectId = "project-two";
		await act(async () => renderFn());
		expect(container.textContent).toBe(
			`hero:${urlFn("hero", "1", "project-two")}|overlay:${urlFn("overlay", "1", "project-two")}`,
		);
	});
});

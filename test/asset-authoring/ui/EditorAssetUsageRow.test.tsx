// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/ui/ui/Button", () => ({
	ButtonLink: ({ children, params, search, to, ...props }: Record<string, unknown>) =>
		createElement(
			"a",
			{
				...props,
				"data-params": JSON.stringify(params),
				"data-search": JSON.stringify(search),
				"data-to": to,
			},
			children as ReactNode,
		),
}));

import { EditorAssetUsageRow } from "~/asset-authoring/ui/EditorAssetUsageRow";
import type { readGameResourceUsagesFn } from "~/game-config-resource/fn/readGameResourceUsagesFn";
import type { Project } from "~/project-authoring/type/Project";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const project = {
	projectId: "project-one",
	title: "Project one",
	version: editorTestPayload.version,
	createdAtMs: 1,
	updatedAtMs: 2,
	revision: 3,
	config: {
		...editorTestPayload.config,
		resources: {
			hero: "hero",
			"avatar-01": "avatar-one",
			"avatar-03": "avatar-three",
		},
	},
	resources: editorTestPayload.resources,
} satisfies Project;

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const renderUsage = async (usage: readGameResourceUsagesFn.Usage) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () =>
		root.render(
			<EditorAssetUsageRow
				dataUi="Usage"
				project={project}
				usage={usage}
			/>,
		),
	);
	const link = container.querySelector<HTMLAnchorElement>("a");
	if (link === null) throw new Error("Expected a routed asset usage.");
	return link;
};

describe("EditorAssetUsageRow", () => {
	it("opens project hero and avatar usages in their exact Artwork destination", async () => {
		const hero = await renderUsage({
			owner: "project",
			ownerLabel: "Project",
			path: [
				"resources",
				"hero",
			],
			resourceId: "hero",
			roleLabel: "Hero",
		});
		expect(JSON.parse(hero.dataset.params ?? "null")).toEqual({
			projectId: project.projectId,
			sectionId: "artwork",
		});
		expect(JSON.parse(hero.dataset.search ?? "null")).toEqual({});

		const avatar = await renderUsage({
			owner: "project",
			ownerLabel: "Project",
			path: [
				"resources",
				"avatar-03",
			],
			resourceId: "avatar-three",
			roleLabel: "Avatar 3",
		});
		expect(JSON.parse(avatar.dataset.params ?? "null")).toEqual({
			projectId: project.projectId,
			sectionId: "artwork",
		});
		expect(JSON.parse(avatar.dataset.search ?? "null")).toEqual({
			avatar: 1,
		});
	});
});

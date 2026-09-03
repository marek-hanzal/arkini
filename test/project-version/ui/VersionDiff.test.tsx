// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		config: {
			items: {
				academy: {
					asset: {
						default: [],
					},
					id: "academy",
					title: "Academy",
					uid: "academy-uid",
				},
			},
		},
		projectId: "project-one",
	}),
}));

vi.mock("~/authoring-form/ui/EditorItemThumbnail", () => ({
	EditorItemThumbnail: () =>
		createElement("span", {
			"data-ui": "EditorItemThumbnail",
		}),
}));

vi.mock("~/ui/ui/Button", () => ({
	ButtonLink: ({ children, params, search: _search, to, ...props }: Record<string, unknown>) =>
		createElement(
			"a",
			{
				...props,
				"data-params": JSON.stringify(params),
				"data-to": to,
			},
			children as ReactNode,
		),
}));

import type { ProjectVersionDiff } from "~/project-version/type/ProjectVersion";
import { VersionDiff } from "~/project-version/ui/VersionDiff";

describe("VersionDiff", () => {
	it("renders the canonical major and minor classifications on their exact changes", () => {
		const diff: ProjectVersionDiff = {
			from: {
				type: "version",
				versionId: "before",
			},
			to: {
				type: "current",
			},
			hasChanges: true,
			project: [
				{
					before: 9,
					after: 8,
					bump: "major",
					path: "config.meta.board.height",
				},
			],
			items: [
				{
					change: "changed",
					uid: "academy",
					values: [
						{
							before: "Academy 2",
							after: "Academy",
							bump: "minor",
							path: "title",
						},
					],
				},
			],
			resources: [],
			scenarios: [],
		};

		const markup = renderToStaticMarkup(<VersionDiff diff={diff} />);

		expect(markup.match(/data-ui-bump="major"/g)).toHaveLength(1);
		expect(markup.match(/data-ui-bump="minor"/g)).toHaveLength(1);
	});

	it("links only diff items that still exist in the current project", () => {
		const diff: ProjectVersionDiff = {
			from: {
				type: "version",
				versionId: "before",
			},
			to: {
				type: "current",
			},
			hasChanges: true,
			project: [],
			items: [
				{
					change: "changed",
					uid: "academy-uid",
					values: [
						{
							before: "Academy 2",
							after: "Academy",
							path: "title",
						},
					],
				},
				{
					change: "deleted",
					uid: "deleted-uid",
					values: [
						{
							before: "Deleted item",
							path: "Entire item",
						},
					],
				},
			],
			resources: [],
			scenarios: [],
		};
		const container = document.createElement("div");
		container.innerHTML = renderToStaticMarkup(<VersionDiff diff={diff} />);

		const available = container.querySelector(
			'[data-ui="EditorVersionItemReference"][data-ui-available="true"]',
		);
		const unavailable = container.querySelector(
			'[data-ui="EditorVersionItemReference"][data-ui-available="false"]',
		);
		const link = available?.querySelector<HTMLAnchorElement>("a");
		expect(available?.querySelector('[data-ui="EditorItemThumbnail"]')).not.toBeNull();
		expect(link?.dataset.to).toBe("/editor/$projectId/editor/items/$itemUid/detail/$sectionId");
		expect(JSON.parse(link?.dataset.params ?? "null")).toEqual({
			itemUid: "academy-uid",
			projectId: "project-one",
			sectionId: "identity",
		});
		expect(unavailable?.querySelector("a")).toBeNull();
	});
});

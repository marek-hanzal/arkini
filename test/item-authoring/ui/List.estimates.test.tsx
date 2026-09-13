// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import type { Project } from "~/project-authoring/type/Project";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { ItemEstimateIndexState } from "~/estimate/ui/useItemEstimateIndex";
import type { ItemEstimateIndexEntry } from "~/estimate/type/ItemEstimateIndex";

const state = vi.hoisted(() => ({
	project: undefined as unknown,
	estimates: undefined as unknown,
}));
vi.mock("~/project-note/ui/useProjectNotes", () => ({
	useProjectNotes: () => ({
		notes: [],
	}),
}));
vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));
vi.mock("~/estimate/ui/useItemEstimateIndex", () => ({
	useItemEstimateIndex: () => state.estimates,
}));
vi.mock("~/authoring-shell/ui/EditorSectionPage", () => ({
	EditorSectionPage: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("~/authoring-form/ui/EditorItemThumbnail", () => ({
	EditorItemThumbnail: () => null,
}));
vi.mock("~/editor-control/ui/EditorVirtualCollection", () => ({
	EditorVirtualCollection: ({
		items,
		renderItemFn,
	}: {
		items: ItemSchema.Type[];
		renderItemFn: (item: ItemSchema.Type) => ReactNode;
	}) =>
		items.map((item) =>
			createElement(
				"div",
				{
					key: item.uid,
				},
				renderItemFn(item),
			),
		),
}));
vi.mock("~/ui/ui/ArtworkCardLink", () => ({
	ArtworkCardLink: ({
		label,
		details,
		params,
	}: {
		label: string;
		details: ReactNode;
		params: {
			itemUid: string;
			sectionId: string;
		};
	}) =>
		createElement(
			"a",
			{
				"data-uid": params.itemUid,
				"data-section": params.sectionId,
			},
			label,
			details,
		),
}));
vi.mock("~/estimate/ui/ItemEstimateMetrics", () => ({
	ItemEstimateMetrics: ({ estimate }: { estimate?: ItemEstimateIndexEntry }) =>
		createElement("span", {
			"data-runtime": estimate?.runtimeMs,
		}),
}));

import { List } from "~/item-authoring/ui/List";
import { editorTestConfig } from "~test/project-authoring/support/editorTestPayload";
import { TranslationTestProvider } from "~test/support/TranslationTestProvider";

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

it("keeps live item identity while rejecting a completed estimate from an older config", async () => {
	const item = {
		...editorTestConfig.items.water,
		id: "ore",
		uid: "ore-uid",
		title: "Old ore",
		asset: {
			scale: 1,
			default: [
				"ore",
			],
		},
	} satisfies ItemSchema.Type;
	const project = {
		projectId: "sample",
		title: "Sample",
		version: {
			major: 1,
			minor: 0,
		},
		createdAtMs: 1,
		updatedAtMs: 1,
		resources: [],
		revision: 1,
		config: {
			...editorTestConfig,
			items: {
				ore: item,
			},
		},
	} satisfies Project;
	const snapshot = {
		projectId: project.projectId,
		revision: project.revision,
		config: project.config,
	};
	const completed = {
		snapshot,
		status: "ready",
		maximumDemand: 1,
		rows: [
			{
				item,
				estimate: {
					itemId: item.id,
					method: "static",
					status: "complete",
					demand: 1,
					runtimeMs: 1000,
				},
			},
		],
	} satisfies ItemEstimateIndexState;
	state.project = project;
	state.estimates = completed;
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	const renderFn = () =>
		act(async () =>
			root.render(
				<TranslationTestProvider>
					<List
						draft={false}
						query=""
						view="name"
						onDraftChangeFn={() => {}}
						onQueryChangeFn={() => {}}
						onViewChangeFn={() => {}}
					/>
				</TranslationTestProvider>,
			),
		);
	await renderFn();
	expect(container.querySelector('[data-runtime="1000"]')).not.toBeNull();

	const currentItem = {
		...item,
		title: "Current ore",
	};
	const currentProject = {
		...project,
		revision: 2,
		config: {
			...project.config,
			items: {
				ore: currentItem,
			},
		},
	};
	state.project = currentProject;
	// The old batch may finish after an authoring update without changing its captured config.
	state.estimates = {
		...completed,
	};
	await renderFn();
	const card = container.querySelector('[data-uid="ore-uid"]');
	expect(card?.textContent).toBe("Current ore");
	expect(card?.getAttribute("data-section")).toBe("identity");
	expect(container.querySelector("[data-runtime]")).toBeNull();

	state.estimates = {
		...completed,
		snapshot: {
			...snapshot,
			config: currentProject.config,
			revision: 2,
		},
		rows: [
			{
				item: currentItem,
				estimate: {
					...completed.rows[0].estimate,
					runtimeMs: 2000,
				},
			},
		],
	};
	await renderFn();
	expect(container.querySelector('[data-runtime="2000"]')).not.toBeNull();
});

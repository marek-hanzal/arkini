// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { readItemConnectionFactsFn } from "~/flow/fn/readItemConnectionFactsFn";

const state = vi.hoisted(() => ({
	origins: [] as readItemConnectionFactsFn.Origin[],
}));

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		config: {
			items: {
				consumer: {
					maxQueueSize: 1,
					lines: [
						{
							id: "specific-line",
						},
					],

					artwork: {
						scale: 0.8,
						default: [],
					},

					description: "Consumes the selected item.",
					title: "Consumer",

					uid: "consumer",
				},
				peer: {
					maxQueueSize: 1,
					lines: [
						{
							id: "specific-line",
						},
					],

					artwork: {
						scale: 0.8,
						default: [],
					},
					description: "Also consumes the selected item.",

					title: "Peer",

					uid: "peer",
				},
				unrelated: {
					maxQueueSize: 1,
					lines: [
						{
							id: "specific-line",
						},
					],

					artwork: {
						scale: 0.8,
						default: [],
					},
					description: "Not connected.",

					title: "Unrelated",

					uid: "unrelated",
				},
			},
		},
		projectId: "project-one",
	}),
}));

vi.mock("~/translation/ui/useTranslator", () => ({
	useTranslator: () => ({
		textFn: (label: string) => label,
	}),
}));

vi.mock("~/item-authoring/fn/readItemConnectionsFn", () => ({
	readItemConnectionsFn: () =>
		[
			{
				maxQueueSize: 1,
				lines: [
					{
						id: "specific-line",
					},
				],

				artwork: {
					scale: 0.8,
					default: [],
				},
				description: "Consumes the selected item.",

				title: "Consumer",

				uid: "consumer",
			},
			{
				maxQueueSize: 1,
				lines: [
					{
						id: "specific-line",
					},
				],

				artwork: {
					scale: 0.8,
					default: [],
				},
				description: "Also consumes the selected item.",

				title: "Peer",

				uid: "peer",
			},
		].map((item) => ({
			item,
			origins: state.origins,
		})),
}));

vi.mock("~/editor-control/ui/EditorSearchCombobox", () => ({
	EditorSearchCombobox: ({
		onChangeFn,
		options,
	}: {
		onChangeFn: (itemUid: string) => void;
		options: ReadonlyArray<{
			readonly id: string;
		}>;
	}) =>
		createElement(
			"button",
			{
				"data-options": options.map(({ id }) => id).join(","),
				"data-ui": "ConnectionSearch",
				onClick: () => onChangeFn("consumer"),
				type: "button",
			},
			"Pick",
		),
}));

vi.mock("~/editor-control/ui/EditorSelect", () => ({
	EditorSelect: ({ onChangeFn }: { onChangeFn: (filter: string) => void }) =>
		createElement(
			"button",
			{
				"data-ui": "ConnectionFilter",
				onClick: () => onChangeFn("produces"),
				type: "button",
			},
			"Filter",
		),
}));

vi.mock("~/authoring-form/ui/EditorItemThumbnail", () => ({
	EditorItemThumbnail: () => createElement("span"),
}));

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

vi.mock("~/ui/ui/LinkButton", async () => ({
	LinkButtonLink: (await import("~/ui/ui/Button")).ButtonLink,
}));

import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { ConnectionsSummaryDetail } from "~/item-authoring/ui/ConnectionsSummaryDetail";
import { ConnectionsSection } from "~/item-authoring/ui/ConnectionsSection";

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
	state.origins = [];
});

describe("ConnectionsSection", () => {
	it("searches only the active connection list and opens result identity detail", async () => {
		const onFilterChangeFn = vi.fn();
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => {
			root.render(
				<ConnectionsSection
					filter="inputs"
					itemUid="material"
					onFilterChangeFn={onFilterChangeFn}
				/>,
			);
		});

		const search = container.querySelector<HTMLButtonElement>('[data-ui="ConnectionSearch"]');
		expect(search?.dataset.options).toBe("consumer,peer");
		expect(container.querySelectorAll('[data-ui="EditorItemConnectionsRow"]')).toHaveLength(2);
		await act(async () => {
			search?.click();
		});
		expect(container.querySelectorAll('[data-ui="EditorItemConnectionsRow"]')).toHaveLength(1);

		await act(async () => {
			container.querySelector<HTMLButtonElement>('[data-ui="ConnectionFilter"]')?.click();
		});
		expect(onFilterChangeFn).toHaveBeenCalledWith("produces");
		const link = container.querySelector<HTMLAnchorElement>("a");
		expect(link?.dataset.to).toBe("/editor/$projectId/editor/items/$itemUid/detail/$sectionId");
		expect(JSON.parse(link?.dataset.params ?? "null")).toEqual({
			itemUid: "consumer",
			projectId: "project-one",
			sectionId: "identity",
		});
		expect(JSON.parse(link?.dataset.search ?? "null")).toEqual({});
	});
});

// The origin belongs to the referenced owner for reverse views and the current owner for forward views.
it.each([
	{
		filter: "produced-by",
		source: {
			type: "expiry",
		},
		sectionId: "clock",
		ownerUid: "consumer",
		search: {
			outcomeSet: 1,
			outcomeRoll: 2,
			outcomeIndex: 1,
		},
	},
	{
		filter: "required-by",
		source: {
			type: "line",
			lineIndex: 0,
			title: "Line",
		},
		sectionId: "production",
		ownerUid: "consumer",
		search: {
			lineId: "specific-line",
			outcomeSet: 1,
			outcomeRoll: 2,
			outcomeIndex: 1,
		},
	},
	{
		filter: "produces",
		source: {
			type: "merge",
			mergeIndex: 2,
		},
		sectionId: "merges",
		ownerUid: "unrelated",
		search: {
			merge: 2,
			outcomeSet: 1,
			outcomeRoll: 2,
			outcomeIndex: 1,
		},
	},
	{
		filter: "inputs",
		source: {
			type: "line",
			lineIndex: 0,
			title: "Line",
		},
		sectionId: "production",
		ownerUid: "unrelated",
		search: {
			lineId: "specific-line",
			outcomeSet: 1,
			outcomeRoll: 2,
			outcomeIndex: 1,
		},
	},
] as const)(
	"links $filter provenance to its exact owner independently of the row",
	async ({ filter, source, sectionId, ownerUid, search }) => {
		state.origins = [
			{
				source,
				role: "output",
				roll: {
					setIndex: 1,
					rollIndex: 2,
					outcomeIndex: 1,
					rollType: "guaranteed",
				},
			},
		];
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () =>
			root.render(
				<ConnectionsSection
					filter={filter}
					itemUid="unrelated"
					onFilterChangeFn={() => {}}
				/>,
			),
		);
		const row = container.querySelector('[data-ui="EditorItemConnectionsRow"]');
		const originLink = row?.querySelector<HTMLAnchorElement>(
			'[data-ui="EditorItemConnectionOriginLink"]',
		);
		const detailLink = row?.querySelector<HTMLAnchorElement>("a");
		expect(JSON.parse(detailLink?.dataset.params ?? "null")).toEqual({
			projectId: "project-one",
			itemUid: "consumer",
			sectionId: "identity",
		});
		expect(JSON.parse(originLink?.dataset.params ?? "null")).toEqual({
			projectId: "project-one",
			itemUid: ownerUid,
			sectionId,
		});
		expect(JSON.parse(originLink?.dataset.search ?? "null")).toEqual(search);
		expect(originLink?.dataset.to).toBe(
			"/editor/$projectId/editor/items/$itemUid/form/$sectionId",
		);
		expect(detailLink?.contains(originLink ?? null)).toBe(false);
		expect(originLink?.parentElement?.closest("a")).toBeNull();
	},
);

it("opens each overview preview's complete collection on the current item", async () => {
	const item = ItemSchema.parse({
		uid: "overview",
		title: "Overview",
		artwork: {
			scale: 0.8,
			default: [
				"overview",
			],
		},
		lines: [],
	});
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => root.render(<ConnectionsSummaryDetail item={item} />));
	const links = [
		...container.querySelectorAll<HTMLAnchorElement>(
			'[data-ui="EditorItemDetailSectionHeader"] a',
		),
	];
	expect(links.map((link) => JSON.parse(link.dataset.search ?? "null"))).toEqual([
		{
			filter: "required-by",
		},
		{
			filter: "inputs",
		},
		{
			filter: "produces",
		},
		{
			filter: "produced-by",
		},
	]);
	for (const link of links) {
		expect(JSON.parse(link.dataset.params ?? "null")).toEqual({
			projectId: "project-one",
			itemUid: "overview",
			sectionId: "connections",
		});
	}
});

it("links each input or condition occurrence with its own selector coordinates", async () => {
	state.origins = [
		{
			source: {
				type: "line",
				lineIndex: 0,
				title: "First line",
			},
			role: "input",
			inputIndex: 2,
		},
		{
			source: {
				type: "clock",
			},
			role: "condition",
			condition: {
				ruleIndex: 1,
				whenIndex: 3,
			},
		},
	];
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () =>
		root.render(
			<ConnectionsSection
				filter="required-by"
				itemUid="unrelated"
				onFilterChangeFn={() => {}}
			/>,
		),
	);
	const row = container.querySelector('[data-ui="EditorItemConnectionsRow"]');
	const links = row?.querySelectorAll<HTMLAnchorElement>(
		'[data-ui="EditorItemConnectionOriginLink"]',
	);
	expect(links).toHaveLength(2);
	expect(
		Array.from(links ?? []).map((link) => ({
			params: JSON.parse(link.dataset.params ?? "null"),
			search: JSON.parse(link.dataset.search ?? "null"),
		})),
	).toEqual([
		{
			params: {
				projectId: "project-one",
				itemUid: "consumer",
				sectionId: "production",
			},
			search: {
				lineId: "specific-line",
				input: 2,
			},
		},
		{
			params: {
				projectId: "project-one",
				itemUid: "consumer",
				sectionId: "clock",
			},
			search: {
				rule: 1,
				when: 3,
			},
		},
	]);
});

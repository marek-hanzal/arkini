// @vitest-environment jsdom
import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import type { GraphResult } from "~/graph/type/GraphResult";
import type { GraphQuerySchema } from "~/graph/schema/GraphQuerySchema";

const state = vi.hoisted(() => ({
	result: undefined as unknown as GraphResult,
	queries: [] as GraphQuerySchema.Type[],
	countResult: undefined as GraphResult | undefined,
	countStatus: "ready" as "ready" | "loading" | "error",
	searchPlaceholder: "",
	filterOptions: [] as {
		value: string;
		trailingLabel?: string;
	}[],
}));
vi.mock("~/graph/ui/useEditorGraphQuery", () => ({
	useEditorGraphQuery: (query: GraphQuerySchema.Type) => {
		state.queries.push(query);
		if (query.detail === "summary" && state.countStatus !== "ready")
			return {
				status: state.countStatus,
			};
		return {
			status: "ready",
			result: query.detail === "summary" ? (state.countResult ?? state.result) : state.result,
		};
	},
}));
vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => project,
}));
vi.mock("~/translation/ui/useTranslator", () => ({
	useTranslator: () => ({
		textFn: (label: string) => label,
	}),
}));
vi.mock("~/authoring-form/ui/EditorItemThumbnail", () => ({
	EditorItemThumbnail: () => createElement("span"),
}));
vi.mock("~/item-authoring/ui/RulesDetail", () => ({
	RulesDetail: () => null,
}));
vi.mock("~/item-authoring/ui/QueryDetail", () => ({
	QueryDetail: () => null,
}));
vi.mock("~/editor-control/ui/EditorSearchCombobox", () => ({
	EditorSearchCombobox: ({
		onChangeFn,
		placeholder,
	}: {
		readonly onChangeFn: (id: string) => void;
		readonly placeholder: string;
	}) => {
		state.searchPlaceholder = placeholder;
		return createElement("button", {
			"data-ui": "Counterpart",
			onClick: () => onChangeFn("item:A"),
		});
	},
}));
vi.mock("~/editor-control/ui/EditorSelect", () => ({
	EditorSelect: ({
		onChangeFn,
		label,
		options,
	}: {
		readonly onChangeFn: (value: string) => void;
		readonly label: string;
		readonly options: {
			value: string;
			trailingLabel?: string;
		}[];
	}) => {
		state.filterOptions = options;
		return createElement("button", {
			"data-ui": "Filter",
			onClick: () => onChangeFn(label === "Depth" ? "2" : "merges-into"),
		});
	},
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
import { ConnectionsSection } from "~/item-authoring/ui/ConnectionsSection";
import { ItemChain } from "~/item-chain/ui/ItemChain";
import { GraphEdgeRow } from "~/graph/ui/GraphEdgeRow";
import { MergeSchema } from "~/item-merge/schema/MergeSchema";
import { GraphNodeReference } from "~/graph/ui/GraphNodeReference";
import type { GraphEdge } from "~/graph/type/GraphFacts";
import { LineSchema } from "~/production-line/schema/LineSchema";

const project = {
	projectId: "project",
	config: {
		start: {
			currentSpace: 0,
			spaces: [
				{
					space: 3,
					templateUid: "layout",
				},
			],
		},
		templates: [
			{
				uid: "layout",
				title: "Layout",
				width: 4,
				height: 4,
				board: [],
			},
		],
		items: Object.fromEntries(
			[
				"A",
				"B",
				"C",
			].map((uid) => [
				uid,
				ItemSchema.parse({
					uid,
					title: uid,
					artwork: {
						default: [
							"art",
						],
						scale: 1,
					},
				}),
			]),
		),
	},
};
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
	state.queries = [];
	state.countResult = undefined;
	state.countStatus = "ready";
});
const mountFn = async (content: ReactNode) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => root.render(content));
	return container;
};
const emptyResultFn = (): GraphResult => ({
	projectId: "project",
	revision: 1,
	status: "yes",
	truncated: false,
	reasons: [],
	expansions: 1,
	paths: [],
	operations: [],
	nodes: [
		{
			id: "item:A",
			kind: "item",
			title: "A",
			missing: false,
			source: [
				"items",
				"A",
			],
		},
		{
			id: "item:B",
			kind: "item",
			title: "B",
			missing: false,
			source: [
				"items",
				"B",
			],
		},
	],
	edges: [],
});

it("asks who merges into the current item and pins a selected counterpart without reversing the authored edge", async () => {
	state.result = {
		...emptyResultFn(),
		edges: [
			{
				id: "merge",
				from: "item:A",
				to: "item:B",
				kind: "merge-target",
				source: [
					"items",
					"A",
					"merge",
					0,
					"target",
					"itemUid",
				],
				annotations: {},
			},
		],
	};
	const onFilterChangeFn = vi.fn();
	const container = await mountFn(
		<ConnectionsSection
			itemUid="B"
			filter="accepts-merge"
			onFilterChangeFn={onFilterChangeFn}
		/>,
	);
	expect(state.queries.at(-1)).toMatchObject({
		kind: "connections",
		from: "item:B",
		direction: "in",
		kinds: [
			"merge-target",
		],
	});
	const links = container.querySelectorAll<HTMLAnchorElement>("article a");
	expect(
		Array.from(links).map((link) => JSON.parse(link.dataset.params ?? "null").itemUid),
	).toEqual([
		"A",
		"B",
	]);
	await act(async () =>
		container.querySelector<HTMLButtonElement>('[data-ui="Counterpart"]')?.click(),
	);
	expect(state.queries.at(-1)?.to).toBe("item:A");
	expect(state.queries.filter((query) => query.detail === "summary").at(-1)).toMatchObject({
		from: "item:B",
		to: "item:A",
		direction: "both",
		limit: 1000,
	});
	await act(async () =>
		container.querySelector<HTMLButtonElement>('[data-ui="Filter"]')?.click(),
	);
	expect(onFilterChangeFn).toHaveBeenCalledWith("merges-into");
});

it("keeps category counts independent of the visible row cap and marks incomplete counts as lower bounds", async () => {
	const edges: GraphEdge[] = Array.from(
		{
			length: 120,
		},
		(_, index) => ({
			id: String(index),
			from: "item:A",
			to: "item:B",
			kind: "merge-target",
			source: [],
			annotations: {},
		}),
	);
	state.countResult = {
		...emptyResultFn(),
		edges,
	};
	state.result = {
		...emptyResultFn(),
		edges: edges.slice(0, 100),
		truncated: true,
		reasons: [
			"limit",
		],
	};
	const root = createRoot(document.createElement("div"));
	roots.push(root);
	const renderFn = async () =>
		act(async () =>
			root.render(
				<ConnectionsSection
					itemUid="B"
					filter="accepts-merge"
					onFilterChangeFn={() => undefined}
				/>,
			),
		);
	const countFn = (value: string) =>
		state.filterOptions.find((option) => option.value === value)?.trailingLabel;
	await renderFn();
	expect(countFn("all")).toBe("120");
	expect(countFn("accepts-merge")).toBe("120");
	expect(countFn("merges-into")).toBe("0");
	expect(state.searchPlaceholder).toContain("(120)");

	state.countResult = {
		...state.countResult,
		truncated: true,
		reasons: [
			"limit",
		],
	};
	await renderFn();
	expect(countFn("all")).toBe("≥120");
	expect(countFn("merges-into")).toBe("≥0");
	expect(state.searchPlaceholder).toContain("(≥120)");

	state.result = {
		...emptyResultFn(),
		edges,
	};
	await renderFn();
	expect(countFn("accepts-merge")).toBe("120");
	expect(state.searchPlaceholder).toContain("(120)");

	state.countStatus = "loading";
	await renderFn();
	expect(countFn("all")).toBe("…");
	expect(countFn("accepts-merge")).toBe("120");
	state.countStatus = "error";
	await renderFn();
	expect(countFn("all")).toBe("—");
});

it("keeps operation edit identity and occurrence coordinates independent of the endpoints", async () => {
	const line = LineSchema.parse({
		uid: "specific-line",
		title: "Specific line",
		description: "Specific",
		runtimeMs: 1000,
		input: [
			{
				type: "simple",
			},
		],
		rules: [],
	});
	const edge = {
		id: "occurrence",
		from: "item:A",
		to: "item:B",
		kind: "line-item-outcome",
		operationId: "line",
		source: [
			"items",
			"A",
			"lines",
			1,
			"outcome",
			"set",
			2,
			"roll",
			3,
			"outcome",
			4,
			"itemUid",
		],
		annotations: {
			inputIndex: 1,
			setIndex: 2,
			rollIndex: 3,
			outcomeIndex: 4,
			ruleIndex: 5,
			whenIndex: 6,
		},
	} as const;
	const container = await mountFn(
		<GraphEdgeRow
			edge={edge}
			nodes={emptyResultFn().nodes}
			operation={{
				id: "line",
				owner: "item:A",
				source: [
					"items",
					"A",
					"lines",
					1,
				],
				kind: "line",
				data: line,
			}}
		/>,
	);
	const link = container.querySelector<HTMLAnchorElement>('[data-ui="EditorGraphOriginLink"]');
	expect(JSON.parse(link?.dataset.params ?? "null")).toEqual({
		projectId: "project",
		itemUid: "A",
		sectionId: "production",
	});
	expect(JSON.parse(link?.dataset.search ?? "null")).toEqual({
		lineUid: "specific-line",
		input: 1,
		outcomeSet: 2,
		outcomeRoll: 3,
		outcomeIndex: 4,
		rule: 5,
		when: 6,
	});
	expect(link?.parentElement?.closest("a")).toBeNull();
});

it("sends Chain depth changes through the canonical consequence query", async () => {
	state.result = {
		...emptyResultFn(),
		edges: [
			{
				id: "expiry",
				from: "item:A",
				to: "item:B",
				kind: "line-item-outcome",
				source: [],
				annotations: {},
			},
		],
	};
	const container = await mountFn(<ItemChain itemUid="A" />);
	expect(state.queries.at(-1)).toMatchObject({
		kind: "traverse",
		from: "item:A",
		direction: "out",
		maxDepth: 5,
		detail: "full",
	});
	expect(state.queries.at(-1)?.kinds).toContain("merge-target-replacement");
	await act(async () =>
		container.querySelector<HTMLButtonElement>('[data-ui="Filter"]')?.click(),
	);
	expect(state.queries.at(-1)?.maxDepth).toBe(2);
});

it.each([
	{
		kind: "merge-target",
		to: "item:B",
	},
	{
		kind: "merge-replacement",
		to: "item:C",
	},
] as const)("keeps all three merge participants in $kind details", async ({ kind, to }) => {
	const operation = {
		id: "merge",
		owner: "item:A",
		source: [
			"items",
			"A",
			"merge",
			0,
		],
		kind: "merge",
		data: MergeSchema.parse({
			target: {
				type: "item",
				itemUid: "B",
			},
			action: "use",
			effect: "replace",
			result: "C",
		}),
	} as const;
	const edge: GraphEdge = {
		id: "edge",
		from: "item:A",
		to,
		kind,
		operationId: operation.id,
		source: operation.source,
		annotations: {},
	};
	const container = await mountFn(
		<GraphEdgeRow
			edge={edge}
			nodes={emptyResultFn().nodes}
			operation={operation}
		/>,
	);
	const links = container.querySelectorAll<HTMLAnchorElement>(
		'[data-ui="EditorGraphMergeParticipants"] a',
	);
	expect(
		Array.from(links).map((link) => JSON.parse(link.dataset.params ?? "null").itemUid),
	).toEqual([
		"A",
		"B",
		"C",
	]);
});

it("names the receiver and its replacement without inventing a transported source identity", async () => {
	const operation = {
		id: "transport",
		owner: "item:A",
		source: [
			"items",
			"A",
			"merge",
			0,
		],
		kind: "merge",
		data: MergeSchema.parse({
			action: "space",
			effect: "replace",
			result: "C",
			space: 7,
		}),
	} as const;
	const edge: GraphEdge = {
		id: "edge",
		from: "item:A",
		to: "space:7",
		kind: "merge-space",
		operationId: operation.id,
		source: operation.source,
		annotations: {},
	};
	const container = await mountFn(
		<GraphEdgeRow
			edge={edge}
			nodes={emptyResultFn().nodes}
			operation={operation}
		/>,
	);
	const participants = container.querySelector('[data-ui="EditorGraphMergeParticipants"]');
	expect(
		Array.from(participants?.querySelectorAll<HTMLAnchorElement>("a") ?? []).map(
			(link) => JSON.parse(link.dataset.params ?? "null").itemUid,
		),
	).toEqual([
		"A",
		"C",
	]);
	const values = participants?.querySelectorAll("dd");
	expect(values?.[1].querySelector("a")).toBeNull();
	expect(values?.[2].textContent).toContain("7");
});

it.each([
	"constructor",
	"toString",
])(
	"renders absent prototype-named item %s without navigating inherited properties",
	async (uid) => {
		const container = await mountFn(
			<GraphNodeReference
				id={`item:${uid}`}
				node={{
					id: `item:${uid}`,
					kind: "item",
					title: uid,
					missing: true,
					source: [],
				}}
			/>,
		);
		expect(container.querySelector("a")).toBeNull();
		expect(container.textContent).toContain(uid);
	},
);

it("navigates a real own prototype-named item normally", async () => {
	Object.defineProperty(project.config.items, "constructor", {
		value: ItemSchema.parse({
			uid: "constructor",
			title: "Real item",
			artwork: {
				default: [
					"art",
				],
				scale: 1,
			},
		}),
		configurable: true,
	});
	try {
		const container = await mountFn(<GraphNodeReference id="item:constructor" />);
		expect(
			JSON.parse(container.querySelector<HTMLAnchorElement>("a")?.dataset.params ?? "null")
				.itemUid,
		).toBe("constructor");
	} finally {
		Reflect.deleteProperty(project.config.items, "constructor");
	}
});

it("links template occurrences to their Board and configured spaces to the requested starting Board", async () => {
	const container = await mountFn(
		<>
			<GraphEdgeRow
				edge={{
					id: "placement",
					from: "template:layout",
					to: "item:B",
					kind: "template-item",
					source: [
						"templates",
						0,
						"board",
						0,
						"itemUid",
					],
					annotations: {
						position: {
							x: 2,
							y: 3,
						},
					},
				}}
				nodes={[]}
			/>
			<GraphNodeReference id="space:3" />
			<GraphNodeReference id="space:99" />
			<GraphEdgeRow
				edge={{
					id: "start",
					from: "space:3",
					to: "template:layout",
					kind: "start-template",
					source: [
						"start",
						"spaces",
						0,
						"templateUid",
					],
					annotations: {},
				}}
				nodes={[]}
			/>
		</>,
	);
	const origins = container.querySelectorAll<HTMLAnchorElement>(
		'[data-ui="EditorGraphOriginLink"]',
	);
	expect(origins[0].dataset.to).toBe(
		"/editor/$projectId/templates/$templateUid/detail/$sectionId",
	);
	expect(JSON.parse(origins[0].dataset.params ?? "null")).toEqual({
		projectId: "project",
		templateUid: "layout",
		sectionId: "board",
	});
	expect(JSON.parse(origins[1].dataset.params ?? "null")).toEqual({
		projectId: "project",
		sectionId: "board",
	});
	expect(origins[1].dataset.to).toBe("/editor/$projectId/project/form/$sectionId");
	const spaceLink = container.querySelector<HTMLAnchorElement>(
		'a[data-to="/editor/$projectId/project/detail/$sectionId"]',
	);
	expect(JSON.parse(spaceLink?.dataset.search ?? "null")).toEqual({
		space: 3,
	});
	expect(
		container.querySelectorAll('a[data-to="/editor/$projectId/project/detail/$sectionId"]'),
	).toHaveLength(2);
});

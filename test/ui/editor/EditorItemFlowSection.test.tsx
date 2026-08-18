// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	canvasProps: undefined as
		| {
				readonly focusNodeId?: string;
				readonly focusRequestKey?: number;
				readonly onSelectionChange: (selection: {
					readonly id: string;
					readonly kind: "node";
				}) => void;
				readonly selection?: {
					readonly id: string;
					readonly kind: string;
				};
		  }
		| undefined,
	flowState: undefined as unknown,
	project: undefined as unknown,
}));

vi.mock("~/bridge/editor/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));

vi.mock("~/ui/item/editor/useEditorItemOriginFlow", () => ({
	useEditorItemOriginFlow: () => state.flowState,
}));

vi.mock("~/ui/item/editor/EditorOriginFlowCanvas", () => ({
	EditorOriginFlowCanvas: (props: typeof state.canvasProps) => {
		state.canvasProps = props;
		return createElement("div", {
			"data-ui": "MockEditorOriginFlowCanvas",
		});
	},
}));

vi.mock("~/ui/item/editor/EditorItemThumbnail", () => ({
	EditorItemSearchThumbnail: () => null,
}));

import type { EditorItemOriginFlow } from "~/bridge/item/editor/EditorItemOriginFlow";
import { EditorItemFlowSection } from "~/ui/item/editor/EditorItemFlowSection";
import { createJobTestConfig } from "~test/job/support/jobTestConfig";

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
	state.canvasProps = undefined;
});

describe("EditorItemFlowSection", () => {
	it("searches every item in the local flow and focuses a selected hidden node", async () => {
		const config = createJobTestConfig();
		const flow: EditorItemOriginFlow = {
			edges: [],
			nodes: [
				{
					id: "node:tool",
					itemId: "tool",
					operations: [],
					resourceIds: config.items.tool.asset.default,
					starterScopes: [],
					title: config.items.tool.title,
					type: config.items.tool.type,
				},
				{
					id: "node:water",
					itemId: "water",
					operations: [],
					resourceIds: config.items.water.asset.default,
					starterScopes: [],
					title: config.items.water.title,
					type: config.items.water.type,
				},
			],
		};
		state.project = {
			config,
		};
		state.flowState = {
			backbones: new Map(),
			flow,
			positions: new Map(),
			progress: {
				label: "Flow ready",
				percent: 100,
			},
			status: "ready",
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(EditorItemFlowSection, {
					itemId: "tool",
				}),
			);
		});

		const input = container.querySelector<HTMLInputElement>('input[placeholder="Search"]');
		if (input === null) throw new Error("Expected local Flow search.");
		await act(async () => input.focus());
		const optionLabels = [
			...document.querySelectorAll('[role="option"]'),
		].map((option) => option.textContent);
		expect(optionLabels).toContain("toolsimple · tool");
		expect(optionLabels).toContain("watersimple · water");
		expect(optionLabels).not.toContain("forgesimple · forge");
		const initialFocusRequestKey = state.canvasProps?.focusRequestKey;
		await act(async () => {
			state.canvasProps?.onSelectionChange({
				id: "node:water",
				kind: "node",
			});
		});
		expect(state.canvasProps?.selection).toEqual({
			id: "node:water",
			kind: "node",
		});
		const toolOption = [
			...document.querySelectorAll<HTMLButtonElement>('[role="option"]'),
		].find((option) => option.textContent?.startsWith("tool"));
		if (toolOption === undefined) throw new Error("Expected tool Flow option.");
		await act(async () => toolOption.click());
		expect(state.canvasProps?.focusNodeId).toBe("node:tool");
		expect(state.canvasProps?.focusRequestKey).not.toBe(initialFocusRequestKey);
		expect(state.canvasProps?.selection).toEqual({
			id: "node:tool",
			kind: "node",
		});

		await act(async () => input.click());

		const waterOption = [
			...document.querySelectorAll<HTMLButtonElement>('[role="option"]'),
		].find((option) => option.textContent?.startsWith("water"));
		if (waterOption === undefined) throw new Error("Expected water Flow option.");
		await act(async () => waterOption.click());

		expect(state.canvasProps?.focusNodeId).toBe("node:water");
		expect(state.canvasProps?.selection).toEqual({
			id: "node:water",
			kind: "node",
		});
	});
});

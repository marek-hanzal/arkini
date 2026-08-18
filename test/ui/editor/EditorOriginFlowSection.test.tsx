// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	canvasProps: undefined as
		| {
				readonly focusNodeId?: string;
				readonly onItemOpen: (itemId: string) => void;
				readonly selection?: {
					readonly id: string;
					readonly kind: string;
				};
		  }
		| undefined,
	navigate: vi.fn(),
	flowState: {
		backbones: new Map(),
		flow: {
			edges: [],
			nodes: [
				{
					id: "node:tool",
					itemId: "tool",
					operations: [],
					resourceIds: [],
					starterScopes: [],
					title: "Tool",
					type: "simple",
				},
			],
		},
		positions: new Map(),
		progress: {
			label: "Flow ready",
			percent: 100,
		},
		status: "ready",
	},
}));

vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => state.navigate,
}));
vi.mock("~/bridge/editor/useEditorProject", () => ({
	useEditorProject: () => ({
		config: {
			items: {
				tool: {
					uid: "tool-uid",
				},
			},
		},
		projectId: "project-test",
	}),
}));
vi.mock("~/ui/item/editor/useEditorItemOriginFlow", () => ({
	useEditorItemOriginFlow: () => state.flowState,
}));
vi.mock("~/ui/item/editor/EditorOriginFlowCanvas", () => ({
	EditorOriginFlowCanvas: (props: typeof state.canvasProps) => {
		state.canvasProps = props;
		return createElement("div");
	},
}));

import { EditorOriginFlowSection } from "~/ui/item/editor/EditorOriginFlowSection";

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
	state.canvasProps = undefined;
	state.navigate.mockReset();
	document.body.replaceChildren();
});

describe("EditorOriginFlowSection", () => {
	it("clears the selected highlight when a focus request clears search", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(EditorOriginFlowSection, {
					focusItemId: "tool",
					focusRequestKey: 1,
				}),
			);
		});
		expect(state.canvasProps).toMatchObject({
			focusNodeId: "node:tool",
			selection: {
				id: "node:tool",
				kind: "node",
			},
		});

		await act(async () => {
			root.render(
				createElement(EditorOriginFlowSection, {
					focusRequestKey: 2,
				}),
			);
		});
		expect(state.canvasProps?.focusNodeId).toBeUndefined();
		expect(state.canvasProps?.selection).toBeUndefined();
	});

	it("opens a clicked item identity in its canonical detail", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(createElement(EditorOriginFlowSection, {}));
		});

		await act(async () => {
			state.canvasProps?.onItemOpen("tool");
		});
		expect(state.navigate).toHaveBeenCalledWith({
			params: {
				itemUid: "tool-uid",
				projectId: "project-test",
				sectionId: "identity",
			},
			to: "/editor/$projectId/editor/items/$itemUid/detail/$sectionId",
		});
	});
});

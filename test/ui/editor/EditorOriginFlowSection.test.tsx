// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	canvasProps: undefined as
		| {
				readonly onItemOpen: (itemId: string) => void;
		  }
		| undefined,
	navigate: vi.fn(),
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
	useEditorItemOriginFlow: () => ({
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
			label: "ready",
			percent: 100,
		},
		status: "ready",
	}),
}));

vi.mock("~/ui/item/editor/EditorOriginFlowCanvas", () => ({
	EditorOriginFlowCanvas: (props: typeof state.canvasProps) => {
		state.canvasProps = props;
		return null;
	},
}));

import { EditorOriginFlowSection } from "~/ui/item/editor/EditorOriginFlowSection";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | undefined;

afterEach(async () => {
	await act(async () => root?.unmount());
	root = undefined;
	state.canvasProps = undefined;
	state.navigate.mockReset();
	document.body.replaceChildren();
});

describe("EditorOriginFlowSection", () => {
	it("routes a graph item ID through its canonical editor identity", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		root = createRoot(container);
		await act(async () => root?.render(createElement(EditorOriginFlowSection, {})));
		if (state.canvasProps === undefined) throw new Error("Missing Flow canvas binding.");

		await act(async () => state.canvasProps?.onItemOpen("tool"));

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

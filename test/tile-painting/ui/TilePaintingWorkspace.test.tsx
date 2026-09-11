// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { useTilePaintingSession } from "~/tile-painting/ui/useTilePaintingSession";

import { TilePaintingWorkspace } from "~/tile-painting/ui/TilePaintingWorkspace";

const state = vi.hoisted(() => ({
	session: undefined as unknown as useTilePaintingSession.Output,
	pathname: "/editor/project/painter/painting/canvas",
}));
vi.mock("~/tile-painting/ui/useTilePaintingSession", () => ({
	useTilePaintingSession: () => state.session,
	useTilePaintingSessionRuntime: () => ({
		readFn: () => state.session,
	}),
}));
vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		projectId: "project",
	}),
}));
vi.mock("@tanstack/react-router", () => ({
	useLocation: () => state.pathname,
	createLink: () => () => null,
}));
vi.mock("~/authoring-shell/ui/EditorHistoryBackButton", () => ({
	EditorHistoryBackButton: () => null,
}));
vi.mock("~/authoring-shell/ui/EditorPageHelp", () => ({
	EditorPageHelp: () => null,
}));
(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
const renderFn = async () => act(async () => root.render(<TilePaintingWorkspace />));
const keyFn = async (key: string, ctrlKey = false) =>
	act(async () => {
		window.dispatchEvent(
			new KeyboardEvent("keydown", {
				key,
				ctrlKey,
				cancelable: true,
			}),
		);
	});
beforeEach(() => {
	state.pathname = "/editor/project/painter/painting/canvas";
	state.session = {
		paintingId: "painting",
		document: {
			name: "Ground",
			images: [],
			layers: [],
			catalog: [],
			scatter: [],
			preview: {
				columns: 1,
				rows: 1,
				cells: [
					{
						kind: "painting",
					},
				],
			},
			reference: null,
		},
		dirty: false,
		busy: false,
		error: null,
		canUndo: true,
		canRedo: false,
		outputResourceId: null,
		activeLayerId: null,
		paintAllLayers: false,
		tool: "reveal",
		brush: {
			size: 80,
			opacity: 1,
			hardness: 1,
			shape: "circle",
			brushImageId: null,
		},
		scatterSpacing: 40,
		previewOpacity: 1,
		referenceOnly: false,
		editFn: vi.fn(),
		undoFn: vi.fn(),
		redoFn: vi.fn(),
		saveFn: vi.fn(),
		addImageFn: vi.fn(),
		setPaintAllLayersFn: vi.fn(),
		setActiveLayerIdFn: vi.fn(),
		setToolFn: vi.fn(),
		setBrushFn: vi.fn(),
		setScatterSpacingFn: vi.fn(),
		setPreviewOpacityFn: vi.fn(),
		setReferenceOnlyFn: vi.fn(),
		setErrorFn: vi.fn(),
		setViewFn: vi.fn(),
	};
	const element = document.createElement("div");
	document.body.append(element);
	root = createRoot(element);
});
afterEach(async () => {
	await act(async () => root.unmount());
	document.body.replaceChildren();
	vi.restoreAllMocks();
});

it("keeps shortcut subscriptions stable while using the latest brush, busy state and routed tab", async () => {
	await renderFn();
	const add = vi.spyOn(window, "addEventListener"),
		remove = vi.spyOn(window, "removeEventListener");
	await keyFn("]");
	expect(state.session.setBrushFn).toHaveBeenLastCalledWith({
		...state.session.brush,
		size: 100,
	});
	state.session = {
		...state.session,
		brush: {
			...state.session.brush,
			size: 100,
		},
	};
	await keyFn("]");
	expect(state.session.setBrushFn).toHaveBeenLastCalledWith({
		...state.session.brush,
		size: 125,
	});
	state.session = {
		...state.session,
		busy: true,
	};
	await renderFn();
	await keyFn("z", true);
	expect(state.session.undoFn).not.toHaveBeenCalled();
	state.session = {
		...state.session,
		busy: false,
	};
	state.pathname = "/editor/project/painter/painting/layers";
	await renderFn();
	await keyFn("e");
	await keyFn("z", true);
	expect(state.session.setToolFn).not.toHaveBeenCalled();
	expect(state.session.undoFn).toHaveBeenCalledOnce();
	expect(add.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(0);
	expect(remove.mock.calls.filter(([type]) => type === "keydown")).toHaveLength(0);
});

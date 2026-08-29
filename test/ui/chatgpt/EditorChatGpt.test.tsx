// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatGptAssetCandidateSchema } from "../../../electron/contract/chatgpt/ChatGptSurfaceSchema";
import { Route as EditorChatGptRouteDefinition } from "~/@routes/editor/$projectId/chatgpt";
import { installChatGptDom, pngBytes } from "./EditorChatGpt.test/fixture";

const EditorChatGpt = EditorChatGptRouteDefinition.options.component;
if (EditorChatGpt === undefined) throw new Error("Editor ChatGPT route component is missing.");

const state = vi.hoisted(() => ({
	assetListeners: new Set<(candidate: ChatGptAssetCandidateSchema.Type) => void>(),
	mutate: vi.fn(),
	project: {
		projectId: "project-one",
		revision: 4,
		resources: [] as ReadonlyArray<{
			readonly id: string;
		}>,
	},
	stateListeners: new Set<(state: { readonly type: "loading" | "ready" }) => void>(),
	unsavedSession: undefined as
		| {
				readonly discard: () => void;
				readonly isDirty: () => boolean;
				readonly isValid: () => Promise<boolean>;
				readonly ownsPathname: (pathname: string) => boolean;
				readonly save: () => Promise<boolean>;
		  }
		| undefined,
}));

vi.mock("@effect/atom-react", () => ({
	useAtomSet: () => state.mutate,
	useAtomValue: () => ({
		waiting: false,
	}),
}));

vi.mock("~/ui/editor/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));

vi.mock("~/ui/resource/editor/saveEditorAssetCommandAtom", () => ({
	saveEditorAssetCommandAtom: () => ({
		id: "save-chatgpt-asset",
	}),
}));

vi.mock("~/renderer/RendererRuntime", async () => {
	const { Effect } = await import("effect");
	return {
		RendererRuntime: {
			runPromise: Effect.runPromise,
			runPromiseExit: Effect.runPromiseExit,
			runSync: Effect.runSync,
		},
	};
});

vi.mock("~/ui/reactivity/readSettledAsyncResultErrorFx", async () => {
	const { Effect } = await import("effect");
	return {
		readSettledAsyncResultErrorFx: () => Effect.succeed(undefined),
	};
});

vi.mock("~/ui/editor/useEditorUnsavedChangesRegistration", () => ({
	useEditorUnsavedChangesRegistration: (session: typeof state.unsavedSession) => {
		state.unsavedSession = session;
	},
}));

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const setSurface = vi.fn(async () => undefined);

beforeEach(() => {
	installChatGptDom();
	state.assetListeners.clear();
	state.stateListeners.clear();
	state.mutate.mockReset().mockResolvedValue(undefined);
	state.project = {
		projectId: "project-one",
		revision: 4,
		resources: [],
	};
	state.unsavedSession = undefined;
	setSurface.mockClear();
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			chatGpt: {
				setSurface,
				onAssetCandidate: (
					listener: (candidate: ChatGptAssetCandidateSchema.Type) => void,
				) => {
					state.assetListeners.add(listener);
					return () => state.assetListeners.delete(listener);
				},
				onStateChanged: (
					listener: (next: { readonly type: "loading" | "ready" }) => void,
				) => {
					state.stateListeners.add(listener);
					return () => state.stateListeners.delete(listener);
				},
			},
		},
	});
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

const renderChatGpt = async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => root.render(<EditorChatGpt />));
	return container;
};

const emitCandidate = async (filename: string) => {
	await act(async () => {
		for (const listener of state.assetListeners) {
			listener({
				projectId: "project-one",
				filename,
				bytes: pngBytes,
			});
		}
		await Promise.resolve();
	});
};

const readButton = (container: HTMLElement, label: string) => {
	const button = [
		...container.querySelectorAll("button"),
	].find((candidate) => candidate.textContent === label);
	if (button === undefined) throw new Error(`Missing ${label} button.`);
	return button;
};

describe("Editor ChatGPT asset confirmation", () => {
	it("shows Arkini loading feedback while the native page is detached", async () => {
		const container = await renderChatGpt();

		expect(container.querySelector('[data-ui="EditorChatGptLoading"]')).not.toBeNull();
		expect(container.textContent).toContain("Loading ChatGPT…");
	});

	it("claims the unsaved candidate before asynchronous PNG decoding settles", async () => {
		let resolveBitmap: ((bitmap: ImageBitmap) => void) | undefined;
		vi.stubGlobal(
			"createImageBitmap",
			vi.fn(
				() =>
					new Promise<ImageBitmap>((resolve) => {
						resolveBitmap = resolve;
					}),
			),
		);
		const container = await renderChatGpt();
		await emitCandidate("Pending Image.png");

		expect(state.unsavedSession?.isDirty()).toBe(true);
		await expect(state.unsavedSession?.isValid()).resolves.toBe(false);
		expect(readButton(container, "Save & return").disabled).toBe(true);

		await act(async () => {
			resolveBitmap?.({
				width: 1,
				height: 1,
				close: vi.fn(),
			} as unknown as ImageBitmap);
			await Promise.resolve();
		});
		expect(readButton(container, "Save & return").disabled).toBe(false);
	});

	it("saves a validated PNG through the revision-pinned single-asset command", async () => {
		const container = await renderChatGpt();
		await emitCandidate("Fresh Image.png");
		expect(
			container.querySelector('[data-ui="EditorChatGptAssetConfirmation"]'),
		).not.toBeNull();
		expect(state.unsavedSession?.isDirty()).toBe(true);
		expect(state.unsavedSession?.ownsPathname("/editor/project-one/chatgpt")).toBe(true);

		await act(async () => readButton(container, "Save & return").click());
		expect(state.mutate).toHaveBeenCalledWith(
			expect.objectContaining({
				expectedRevision: 4,
				overwrite: false,
				resourceId: "fresh-image",
			}),
		);
		expect(container.querySelector('[data-ui="EditorChatGptAssetConfirmation"]')).toBeNull();
	});

	it("discards without persistence and returns to the same live surface", async () => {
		const container = await renderChatGpt();
		await emitCandidate("Discard Me.png");
		await act(async () => readButton(container, "Discard & return").click());

		expect(state.mutate).not.toHaveBeenCalled();
		expect(state.unsavedSession?.isDirty()).toBe(false);
		expect(setSurface).toHaveBeenLastCalledWith(
			expect.objectContaining({
				projectId: "project-one",
			}),
		);
	});

	it("requires a second explicit action before replacing a colliding asset", async () => {
		state.project = {
			...state.project,
			resources: [
				{
					id: "existing",
				},
			],
		};
		const container = await renderChatGpt();
		await emitCandidate("Existing.png");
		expect(container.querySelector('[data-ui="EditorChatGptAssetCollision"]')).not.toBeNull();

		await act(async () => readButton(container, "Save & return").click());
		expect(state.mutate).not.toHaveBeenCalled();
		expect(readButton(container, "Replace asset")).not.toBeNull();
		await act(async () => readButton(container, "Replace asset").click());
		expect(state.mutate).toHaveBeenCalledWith(
			expect.objectContaining({
				expectedRevision: 4,
				overwrite: true,
				resourceId: "existing",
			}),
		);
	});
});

// @vitest-environment jsdom

import { Effect } from "effect";
import { installRendererNativeDragGuardFx } from "~/application-runtime/fx/installRendererNativeDragGuardFx";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { act, type PropsWithChildren } from "react";
import { HotkeysProvider } from "@tanstack/react-hotkeys";
import { TranslationTestProvider } from "~test/support/TranslationTestProvider";
import { EditorSfxManager } from "~/sfx-authoring/ui/EditorSfxManager";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("~/authoring-shell/ui/EditorHistoryBackButton", () => ({
	EditorHistoryBackButton: () => null,
}));
vi.mock("~/authoring-shell/ui/EditorPageHelp", () => ({
	EditorPageHelp: () => null,
}));
vi.mock("@tanstack/react-router", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-router")>()),
	Link: ({ children }: PropsWithChildren) => <span>{children}</span>,
}));

const state = vi.hoisted(() => ({
	assignSfxFn: vi.fn(),
	importSfxFn: vi.fn(),
	optimizeResourcesFn: vi.fn(),
	setCall: 0,
	valueCall: 0,
}));

vi.mock("@effect/atom-react", async (importOriginal) => ({
	...(await importOriginal<typeof import("@effect/atom-react")>()),
	useAtomSet: () =>
		[
			state.importSfxFn,
			state.assignSfxFn,
			state.optimizeResourcesFn,
		][state.setCall++ % 3],
	useAtomValue: () =>
		state.valueCall++ % 4 === 1
			? {
					master: 100,
					music: 10,
					sfx: 5,
				}
			: state.valueCall % 4 === 0
				? {
						kind: "idle",
					}
				: AsyncResult.initial(),
}));

vi.mock("~/resource-authoring/atom/EditorResourceOptimizationAtom", () => ({
	EditorResourceOptimizationAtom: () => ({}),
}));

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		config: {
			sfx: {
				events: {
					"job:started": "old-start",
					"item:spawned": "shared-sfx",
				},
			},
		},
		projectId: "project-one",
		revision: 7,
		resources: [
			{
				id: "old-start",
				size: 47,
				type: "sfx",
				version: "1",
			},
			{
				id: "shared-sfx",
				size: 48,
				type: "sfx",
				version: "1",
			},
			{
				id: "unused-sfx",
				size: 49,
				type: "sfx",
				version: "1",
			},
		],
	}),
}));

vi.mock("~/authoring-session/ui/ResourceUrlSession", () => ({
	useResourceUrls: () => new Map(),
}));

import { useEditorSfxManagerController } from "~/sfx-authoring/ui/useEditorSfxManagerController";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

let root: ReturnType<typeof createRoot> | undefined;
let controller: ReturnType<typeof useEditorSfxManagerController> | undefined;

const Probe = () => {
	controller = useEditorSfxManagerController();
	return null;
};

beforeEach(async () => {
	state.assignSfxFn.mockReset();
	state.importSfxFn.mockReset();
	state.optimizeResourcesFn.mockReset();
	state.setCall = 0;
	state.valueCall = 0;
	const container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
	await act(async () => root?.render(<Probe />));
});

afterEach(async () => {
	await act(async () => root?.unmount());
	root = undefined;
	controller = undefined;
	document.body.replaceChildren();
});

describe("useEditorSfxManagerController", () => {
	it("filters searched SFX by assignment usage", async () => {
		expect(controller?.sfx.map(({ id }) => id)).toEqual([
			"old-start",
			"shared-sfx",
			"unused-sfx",
		]);

		await act(async () => controller?.setViewFn("assigned"));
		expect(controller?.sfx.map(({ id }) => id)).toEqual([
			"old-start",
			"shared-sfx",
		]);

		await act(async () => controller?.setViewFn("unused"));
		expect(controller?.sfx.map(({ id }) => id)).toEqual([
			"unused-sfx",
		]);
	});

	it("replaces the resource assigned to one exact gameplay event", async () => {
		await act(async () => controller?.assignResourceFn("job:started", "shared-sfx"));

		expect(state.assignSfxFn).toHaveBeenCalledWith({
			config: {
				sfx: {
					events: {
						"job:started": "shared-sfx",
						"item:spawned": "shared-sfx",
					},
				},
			},
			expectedRevision: 7,
			projectId: "project-one",
		});
	});

	it("removes only the explicitly cleared slot", async () => {
		await act(async () => controller?.assignResourceFn("item:spawned", undefined));

		expect(state.assignSfxFn).toHaveBeenCalledWith({
			config: {
				sfx: {
					events: {
						"job:started": "old-start",
					},
				},
			},
			expectedRevision: 7,
			projectId: "project-one",
		});
	});

	it("keeps the assignment when the same sound is dropped again and rejects unknown resources", async () => {
		await act(async () => controller?.assignResourceFn("job:started", "old-start"));
		await act(async () => controller?.assignResourceFn("job:started", "missing"));
		expect(state.assignSfxFn).not.toHaveBeenCalled();
	});

	it("reveals assigned sounds through both filters and permits repeated reveal requests", async () => {
		await act(async () => {
			controller?.setViewFn("unused");
			controller?.setQueryFn("unused");
		});
		await act(async () => controller?.revealResourceFn("old-start"));
		expect(controller?.view).toBe("all");
		expect(controller?.query).toBe("");
		expect(controller?.sfx.some(({ id }) => id === "old-start")).toBe(true);
		const firstRequest = controller?.revealedResource;
		await act(async () => controller?.revealResourceFn("old-start"));
		expect(controller?.revealedResource).toEqual({
			id: "old-start",
		});
		expect(controller?.revealedResource).not.toBe(firstRequest);
	});

	it("routes a library drag to the exact slot and reveals its assigned row through filters", async () => {
		const removeDragGuardFn = Effect.runSync(
			installRendererNativeDragGuardFx({
				root: document.body,
			}),
		);
		const scrollFn = vi.fn();
		Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
			configurable: true,
			value: scrollFn,
		});
		try {
			await act(async () =>
				root?.render(
					<TranslationTestProvider>
						<HotkeysProvider>
							<EditorSfxManager />
						</HotkeysProvider>
					</TranslationTestProvider>,
				),
			);
			const rows = document.querySelectorAll('[data-ui="EditorSfxRow"]');
			const slot = document.querySelector('[data-event="job:started"]')!;
			const transfer = {
				setData: vi.fn(),
				effectAllowed: "",
				dropEffect: "",
			};
			const dragFn = async (target: Element, type: string) => {
				const event = new Event(type, {
					bubbles: true,
					cancelable: true,
				});
				Object.defineProperty(event, "dataTransfer", {
					value: transfer,
				});
				await act(async () => {
					target.dispatchEvent(event);
				});
				return event;
			};
			await dragFn(slot, "drop");
			expect(state.assignSfxFn).not.toHaveBeenCalled();
			expect((await dragFn(rows[2]!, "dragstart")).defaultPrevented).toBe(false);
			expect((await dragFn(slot, "dragover")).defaultPrevented).toBe(true);
			await dragFn(slot, "drop");
			expect(state.assignSfxFn).toHaveBeenCalledWith(
				expect.objectContaining({
					config: {
						sfx: {
							events: {
								"job:started": "unused-sfx",
								"item:spawned": "shared-sfx",
							},
						},
					},
				}),
			);
			const unused = Array.from(document.querySelectorAll("button")).find(
				(button) => button.textContent === "Unused",
			)!;
			await act(async () => unused.click());
			await act(async () =>
				(slot.querySelector('[data-ui="EditorSfxReveal"]') as HTMLButtonElement).click(),
			);
			expect(
				document.querySelector('[data-ui="EditorSfxRow"][data-ui-selected="true"]')
					?.textContent,
			).toContain("old-start");
			expect(scrollFn).toHaveBeenCalled();
		} finally {
			removeDragGuardFn();
			Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
		}
	});

	it("optimizes every existing SFX regardless of the current view", async () => {
		await act(async () => controller?.setViewFn("unused"));
		controller?.onOptimizeFn();

		expect(state.optimizeResourcesFn).toHaveBeenCalledWith({
			expectedRevision: 7,
			kind: "optimize",
			resourceIds: [
				"old-start",
				"shared-sfx",
				"unused-sfx",
			],
			type: "sfx",
		});
	});
});

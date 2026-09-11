// @vitest-environment jsdom
import { act, type PropsWithChildren } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import type { EditorUnsavedChangesSession } from "~/authoring-session/service/EditorUnsavedChanges";
import type { TilePaintingSchema } from "~/tile-painting/schema/TilePaintingSchema";
import {
	TilePaintingSessionProvider,
	useTilePaintingSession,
	useTilePaintingSessionRuntime,
} from "~/tile-painting/ui/useTilePaintingSession";
import type { makeTilePaintingSessionFx } from "~/tile-painting/fx/makeTilePaintingSessionFx";
import { TilePaintingDocumentPage } from "~/tile-painting/ui/TilePaintingDocumentPage";

const state = vi.hoisted(() => ({
	runPromiseFn: vi.fn(),
	refreshFn: vi.fn(),
	registration: undefined as EditorUnsavedChangesSession | undefined,
}));
vi.mock("~/application-runtime/service/RendererRuntime", async () => {
	const { Effect } = await import("effect");
	const AtomRegistry = await import("effect/unstable/reactivity/AtomRegistry");
	const { ProjectRepository } = await import("~/project-authoring/service/ProjectRepository");
	return {
		RendererRuntime: {
			runSync: Effect.runSync,
			runPromise: (
				fx: import("effect").Effect.Effect<
					unknown,
					unknown,
					| import("~/project-authoring/service/ProjectRepository").ProjectRepository
					| import("effect/unstable/reactivity/AtomRegistry").AtomRegistry
				>,
			) =>
				Effect.runPromise(
					fx.pipe(
						Effect.provideService(ProjectRepository, {
							readTilePaintingFx: () =>
								Effect.tryPromise({
									try: () => state.runPromiseFn(),
									catch: (cause) => cause,
								}),
							saveTilePaintingFx: () =>
								Effect.tryPromise({
									try: () => state.runPromiseFn(),
									catch: (cause) => cause,
								}),
						} as never),
						Effect.provide(AtomRegistry.layer),
					),
				),
		},
	};
});
vi.mock("~/tile-painting/fx/createTilePaintingImageFx", async () => {
	const { Effect } = await import("effect");
	return {
		createTilePaintingImageFx: () =>
			Effect.tryPromise({
				try: () => state.runPromiseFn(),
				catch: (cause) => cause,
			}),
	};
});
vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		projectId: "project",
		revision: 10,
	}),
}));
vi.mock("~/authoring-session/ui/useEditorUnsavedChangesRegistration", () => ({
	useEditorUnsavedChangesOwner: () => ({
		refreshFn: state.refreshFn,
	}),
	useEditorUnsavedChangesRegistration: (registration: EditorUnsavedChangesSession) => {
		state.registration = registration;
	},
}));
vi.mock("~/tile-painting/ui/TilePaintingWorkspace", () => ({
	TilePaintingWorkspace: ({ children }: PropsWithChildren) => children,
}));
vi.mock("@tanstack/react-router", () => ({
	Outlet: () => <Probe />,
	createLink: () => () => null,
}));
vi.mock("~/ui/ui/LinkButton", () => ({
	LinkButtonLink: () => null,
}));

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let session: useTilePaintingSession.Output;
let runtime: makeTilePaintingSessionFx.Output;
const sessionRenders = vi.fn();
const loaded: TilePaintingSchema.Type = {
	paintingId: "painting",
	projectId: "project",
	updatedAtMs: 1,
	outputResourceId: null,
	document: {
		name: "Ground",
		images: [],
		layers: [],
		catalog: [],
		scatter: [],
		preview: {
			columns: 3,
			rows: 3,
			cells: Array.from(
				{
					length: 9,
				},
				() => ({
					kind: "painting" as const,
				}),
			),
		},
		reference: null,
	},
};
const Probe = () => {
	session = useTilePaintingSession();
	runtime = useTilePaintingSessionRuntime();
	sessionRenders();
	return null;
};
const mountFn = async (tab = "canvas") =>
	act(async () =>
		root.render(
			<TilePaintingSessionProvider loaded={loaded}>
				<Probe key={tab} />
			</TilePaintingSessionProvider>,
		),
	);
beforeEach(() => {
	state.runPromiseFn.mockReset();
	state.refreshFn.mockReset();
	const element = document.createElement("div");
	document.body.append(element);
	root = createRoot(element);
});
afterEach(async () => {
	await act(async () => root.unmount());
	document.body.replaceChildren();
});

describe("Painting document session boundaries", () => {
	it("isolates view updates from session and command consumers without dirtying the painting", async () => {
		await mountFn();
		sessionRenders.mockClear();
		state.refreshFn.mockClear();
		const initialSession = session;
		for (let i = 1; i <= 3; i++) {
			await act(async () =>
				session.setViewFn({
					zoom: i,
					panX: i * 10,
					panY: i * 20,
				}),
			);
		}
		expect(runtime.readFn().view).toEqual({
			zoom: 3,
			panX: 30,
			panY: 60,
		});
		expect(sessionRenders).not.toHaveBeenCalled();
		expect(state.refreshFn).not.toHaveBeenCalled();
		expect(session).toBe(initialSession);
		expect(session.dirty).toBe(false);
	});

	it("refreshes the process leave projection when the imperative session changes", async () => {
		await mountFn();
		state.refreshFn.mockClear();
		await act(async () => {
			session.editFn({
				...session.document,
				name: "Changed",
			});
			expect(state.registration!.isDirtyFn()).toBe(true);
			expect(state.refreshFn).toHaveBeenCalledOnce();
		});
	});

	it("keeps distinct source identities when two selected assets have identical pixels", async () => {
		await mountFn();
		for (const [id, sourceResourceId] of [
			[
				"image-a",
				"asset-a",
			],
			[
				"image-b",
				"asset-b",
			],
			[
				"another-a",
				"asset-a",
			],
		]) {
			state.runPromiseFn.mockResolvedValueOnce({
				id,
				sourceResourceId,
				label: sourceResourceId,
				png: "data:image/png;base64,YQ==",
			});
			await act(async () =>
				session.addImageFn(
					{
						id: sourceResourceId,
						mime: "image/png",
						bytes: new Uint8Array(),
					},
					(document) => document,
				),
			);
		}
		expect(session.document.images.map((image) => image.sourceResourceId)).toEqual([
			"asset-a",
			"asset-b",
		]);
	});
	it("preserves document history and view while routed tab children remount, and redoes identical scatter instances", async () => {
		await mountFn();
		const painted = {
			...loaded.document,
			images: [
				{
					id: "flower",
					label: "Flower",
					sourceResourceId: "item-water",
					png: "data:image/png;base64,YQ==",
				},
			],
			layers: [
				{
					id: "ground",
					name: "Ground",
					imageId: "flower",
					visible: true,
					opacity: 1,
					tileSize: 256,
					strokes: [],
					shadow: {
						enabled: true,
						color: "#31192b",
						opacity: 0.4,
						blur: 16,
						offsetX: -8,
						offsetY: 12,
					},
				},
			],
			scatter: [
				{
					stamps: [
						{
							imageId: "flower",
							x: 20,
							y: 30,
							size: 16,
						},
					],
				},
			],
		};
		await act(async () => {
			session.editFn(painted);
			session.setPaintAllLayersFn(true);
			session.setViewFn({
				zoom: 2,
				panX: 30,
				panY: 40,
			});
		});
		await mountFn("scattering");
		expect(session.document).toBe(painted);
		expect(session.paintAllLayers).toBe(true);
		expect(runtime.readFn().view).toEqual({
			zoom: 2,
			panX: 30,
			panY: 40,
		});
		await act(async () => session.undoFn());
		expect(session.document).toBe(loaded.document);
		await act(async () => session.redoFn());
		expect(session.document.scatter).toBe(painted.scatter);
		expect(session.document.layers).toBe(painted.layers);
		expect(state.registration?.ownsPathnameFn("/editor/project/painter/painting/layers")).toBe(
			true,
		);
		expect(
			state.registration?.ownsPathnameFn("/editor/project/painter/painting-other/canvas"),
		).toBe(false);
	});

	it("clears a custom brush reference when undo removes its image", async () => {
		await mountFn();
		await act(async () => {
			session.editFn({
				...loaded.document,
				images: [
					{
						id: "stamp",
						label: "Stamp",
						sourceResourceId: "item-water",
						png: "data:image/png;base64,YQ==",
					},
				],
			});
			session.setBrushFn({
				...session.brush,
				shape: "image",
				brushImageId: "stamp",
			});
		});
		expect(session.brush.brushImageId).toBe("stamp");
		await act(async () => session.undoFn());
		expect(session.brush.brushImageId).toBeNull();
		await act(async () => session.redoFn());
		expect(session.brush.brushImageId).toBe("stamp");
	});

	it("settles the saved baseline before the leave guard proceeds, and keeps failed saves dirty", async () => {
		await mountFn();
		const changed = {
			...loaded.document,
			name: "Path",
		};
		await act(async () => session.editFn(changed));
		state.runPromiseFn.mockRejectedValueOnce(new Error("Disk full"));
		await act(async () => {
			expect(await session.saveFn()).toBe(false);
		});
		expect(session.dirty).toBe(true);
		expect(session.error).toContain("Disk full");
		state.runPromiseFn.mockResolvedValueOnce({
			savedDocument: changed,
			painting: {
				...loaded,
				updatedAtMs: 2,
				document: structuredClone(changed),
			},
			project: {
				projectId: "project",
				revision: 10,
			},
		});
		await act(async () => {
			expect(await state.registration!.saveFn()).toBe(true);
			expect(state.registration!.isDirtyFn()).toBe(false);
		});
		expect(session.dirty).toBe(false);
		await act(async () => session.undoFn());
		expect(session.dirty).toBe(true);
		await act(async () => session.redoFn());
		expect(session.dirty).toBe(false);
	});

	it("reacquires the latest recipe and freshness after project replacement remounts the page", async () => {
		state.runPromiseFn.mockResolvedValueOnce(loaded);
		await act(async () =>
			root.render(
				<TilePaintingDocumentPage
					key="epoch-one"
					paintingId="painting"
				/>,
			),
		);
		expect(session.document.name).toBe("Ground");
		const refreshed = {
			...loaded,
			updatedAtMs: 20,
			document: {
				...loaded.document,
				name: "Saved elsewhere",
			},
		};
		state.runPromiseFn.mockResolvedValueOnce(refreshed);
		await act(async () =>
			root.render(
				<TilePaintingDocumentPage
					key="epoch-two"
					paintingId="painting"
				/>,
			),
		);
		expect(session.document).toBe(refreshed.document);
		expect(session.dirty).toBe(false);
		state.runPromiseFn.mockResolvedValueOnce(null);
		await act(async () =>
			root.render(
				<TilePaintingDocumentPage
					key="epoch-three"
					paintingId="painting"
				/>,
			),
		);
		expect(document.body.textContent).toContain("Painting not found");
	});
});

// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { Effect as EffectModule } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import { ProjectRepositoryError } from "~/project-authoring/error/ProjectRepositoryError";
import type { Project } from "~/project-authoring/type/Project";
import type { EditorUnsavedChangesSession } from "~/authoring-session/service/EditorUnsavedChanges";
import {
	createTestPngBytes,
	installTestPngDecoder,
} from "~test/serapack-support/fn/createTestPngBytes";
import {
	editorTestResources,
	editorTestPayload,
} from "~test/project-authoring/support/editorTestPayload";

const state = vi.hoisted(() => ({
	navigate: vi.fn(async () => undefined),
	project: undefined as unknown as Project,
	replaceResource: vi.fn(),
	session: undefined as unknown as EditorUnsavedChangesSession,
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-router")>()),
	useNavigate: () => state.navigate,
}));

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));

vi.mock("~/artwork-authoring/ui/useEditorArtworkByUid", () => ({
	useEditorArtworkByUid: (resourceUid: string) =>
		state.project.resources.find(({ uid }) => uid === resourceUid),
}));

vi.mock("~/authoring-session/ui/ResourceUrlSession", () => ({
	useResourceUrl: () => "blob:resource",
}));

vi.mock("~/authoring-session/ui/useEditorUnsavedChangesRegistration", () => ({
	useEditorUnsavedChangesRegistration: (session: typeof state.session) => {
		state.session = session;
	},
}));

vi.mock("~/application-runtime/service/RendererRuntime", async () => {
	const { Effect } = await import("effect");
	const { ProjectRepository } = await import("~/project-authoring/service/ProjectRepository");
	const { ProjectWriteAdmission } = await import(
		"~/project-authoring/service/ProjectWriteAdmission"
	);
	const { createProjectWriteAdmissionFx } = await import(
		"~/project-authoring/fx/createProjectWriteAdmissionFx"
	);
	const admission = Effect.runSync(createProjectWriteAdmissionFx);
	const repository = {
		readProjectFx: () => Effect.succeed(state.project),
		replaceResourceFx: (...args: ReadonlyArray<unknown>) => state.replaceResource(...args),
	};
	const provideRepositoryFn = (effect: EffectModule.Effect<unknown, unknown, unknown>) =>
		effect.pipe(
			Effect.provideService(ProjectRepository, repository as never),
			Effect.provideService(ProjectWriteAdmission, admission),
		) as EffectModule.Effect<unknown, unknown, never>;
	return {
		RendererRuntime: {
			runPromise: (effect: EffectModule.Effect<unknown, unknown, unknown>) =>
				Effect.runPromise(provideRepositoryFn(effect)),
			runPromiseExit: (effect: EffectModule.Effect<unknown, unknown, unknown>) =>
				Effect.runPromiseExit(provideRepositoryFn(effect)),
			runSync: (effect: EffectModule.Effect<unknown, unknown, unknown>) =>
				Effect.runSync(provideRepositoryFn(effect)),
		},
	};
});

import { useEditorArtworkEditController } from "~/artwork-authoring/ui/useEditorArtworkEditController";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const registries: AtomRegistry.AtomRegistry[] = [];
const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const registry of registries.splice(0)) registry.dispose();
	state.navigate.mockClear();
	state.replaceResource.mockReset();
	vi.restoreAllMocks();
	document.body.replaceChildren();
});

const mountEditor = async () => {
	state.project = {
		projectId: "project",
		title: editorTestPayload.config.meta.title,
		version: {
			major: 1,
			minor: 0,
		},
		createdAtMs: 1,
		updatedAtMs: 2,
		revision: 3,
		config: editorTestPayload.config,
		resources: editorTestResources,
	};
	state.replaceResource.mockImplementation(() => EffectModule.succeed(state.project));
	installTestPngDecoder();
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	registries.push(registry);
	let controller!: useEditorArtworkEditController.Output;
	const Probe = () => {
		controller = useEditorArtworkEditController({
			filter: "all",
			query: "",
			resourceUid: "item-water",
		});
		return null;
	};
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () =>
		root.render(
			createElement(
				RegistryContext.Provider,
				{
					value: registry,
				},
				createElement(Probe),
			),
		),
	);
	return {
		read: () => controller,
		rerender: () =>
			root.render(
				createElement(
					RegistryContext.Provider,
					{
						value: registry,
					},
					createElement(Probe),
				),
			),
		unmount: () => root.render(null),
	};
};

it.each([
	"discard",
	"unmount",
] as const)(
	"cancels artwork preflight on %s before it can mutate a replacement",
	async (boundary) => {
		const editor = await mountEditor();
		const bytes = createTestPngBytes();
		let release!: (bitmap: ImageBitmap) => void;
		const decode = vi.mocked(createImageBitmap).mockImplementation(
			() =>
				new Promise<ImageBitmap>((resolve) => {
					release = resolve;
				}),
		);
		const file = new File(
			[
				bytes,
			],
			"replacement.png",
			{
				type: "image/png",
			},
		);
		await act(async () => editor.read().setFileFn(file));
		let saving!: Promise<boolean>;
		await act(async () => {
			saving = editor.read().saveFn();
			await Promise.resolve();
		});
		expect(editor.read().saving).toBe(true);
		expect(await editor.read().saveFn()).toBe(false);
		expect(decode).toHaveBeenCalledOnce();
		await act(async () => {
			if (boundary === "discard") state.session.discardFn();
			else editor.unmount();
			state.project = {
				...state.project,
				revision: 4,
			};
		});
		release({
			width: 1,
			height: 1,
			close: vi.fn(),
		} as unknown as ImageBitmap);
		await act(async () => expect(await saving).toBe(false));
		expect(state.replaceResource).not.toHaveBeenCalled();
		expect(state.navigate).not.toHaveBeenCalled();
		if (boundary === "discard") {
			expect(editor.read().saving).toBe(false);
			expect(editor.read().dirty).toBe(false);
		}
	},
);

it("keeps an admitted title edit fixed while preserving identity", async () => {
	const editor = await mountEditor();
	let finish!: () => void;
	state.replaceResource.mockImplementation(({ resourceUid, resource }) =>
		EffectModule.promise(
			() =>
				new Promise<Project>((resolve) => {
					finish = () => {
						state.project = {
							...state.project,
							revision: 4,
							resources: state.project.resources.map((candidate) =>
								candidate.uid === resourceUid ? resource : candidate,
							),
						};
						resolve(state.project);
					};
				}),
		),
	);
	await act(async () => editor.read().setTitleFn("new-item-water"));
	let saving!: Promise<boolean>;
	await act(async () => {
		saving = editor.read().saveFn();
	});
	await vi.waitFor(() => expect(state.replaceResource).toHaveBeenCalledOnce());
	await act(async () => editor.read().setTitleFn("another-item-water"));
	expect(editor.read().title).toBe("new-item-water");
	await act(async () => {
		finish();
		expect(await saving).toBe(true);
	});
	expect(state.project.resources.some(({ uid }) => uid === "item-water")).toBe(true);
	expect(state.navigate).toHaveBeenCalledWith(
		expect.objectContaining({
			params: {
				projectId: "project",
				resourceUid: "item-water",
			},
		}),
	);
});

it.each([
	"typed",
	"defect",
] as const)("discards only ordinary errors from a stale %s command", async (kind) => {
	const editor = await mountEditor();
	let fail!: () => void;
	const failWrite = () =>
		new Promise<never>((_resolve, reject) => {
			fail = () =>
				reject(
					kind === "typed"
						? new ProjectRepositoryError({
								operation: "replace-resource",
								message: "stale revision",
							})
						: new Error("write defect"),
				);
		});
	state.replaceResource.mockImplementation(() =>
		kind === "typed"
			? EffectModule.tryPromise({
					try: failWrite,
					catch: (cause) => cause as ProjectRepositoryError,
				})
			: EffectModule.promise(failWrite),
	);
	await act(async () => editor.read().setTitleFn("new-item-water"));
	let saving!: Promise<boolean>;
	await act(async () => {
		saving = editor.read().saveFn();
	});
	await vi.waitFor(() => expect(state.replaceResource).toHaveBeenCalledOnce());
	await act(async () => state.session.discardFn());
	const completion = act(async () => {
		fail();
		expect(await saving).toBe(false);
	});
	if (kind === "typed") {
		await completion;
		expect(editor.read().error).toBeUndefined();
		expect(editor.read().title).toBe("item-water");
		expect(editor.read().dirty).toBe(false);
	} else {
		await expect(completion).rejects.toHaveProperty("reasons.0._tag", "Die");
	}
	expect(state.navigate).not.toHaveBeenCalled();
});

it("discards the artwork draft before navigating without persisting a rename or image", async () => {
	const editor = await mountEditor();
	await act(async () => {
		editor.read().setTitleFn("renamed-item-water");
		editor.read().setFileFn(
			new File([], "replacement.png", {
				type: "image/png",
			}),
		);
	});
	expect(editor.read().dirty).toBe(true);
	await act(async () => editor.read().discardFn());
	expect(editor.read().dirty).toBe(false);
	expect(editor.read().title).toBe("item-water");
	expect(editor.read().file).toBeUndefined();
	expect(state.session.isDirtyFn()).toBe(false);
	expect(state.replaceResource).not.toHaveBeenCalled();
	expect(state.navigate).toHaveBeenCalledWith({
		to: "/editor/$projectId/artwork/$resourceUid/detail/overview",
		params: {
			projectId: "project",
			resourceUid: "item-water",
		},
		search: {
			filter: "all",
			query: "",
		},
		replace: true,
	});
});

it("follows refreshed titles while pristine and discards a draft to the latest canonical title", async () => {
	const editor = await mountEditor();
	const refreshTitle = (title: string) => {
		state.project = {
			...state.project,
			resources: state.project.resources.map((resource) =>
				resource.uid === "item-water"
					? {
							...resource,
							title,
						}
					: resource,
			),
		};
	};
	await act(async () => {
		refreshTitle("Fresh water");
		editor.rerender();
	});
	expect(editor.read().title).toBe("Fresh water");
	expect(editor.read().dirty).toBe(false);
	await act(async () => editor.read().setTitleFn("Draft"));
	await act(async () => {
		refreshTitle("Latest water");
		editor.rerender();
	});
	expect(editor.read().title).toBe("Draft");
	await act(async () => editor.read().discardFn());
	expect(editor.read().title).toBe("Latest water");
	expect(editor.read().dirty).toBe(false);
	expect(state.replaceResource).not.toHaveBeenCalled();
});

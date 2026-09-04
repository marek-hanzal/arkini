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
} from "~test/arkpack-support/fn/createTestPngBytes";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

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

vi.mock("~/asset-authoring/ui/useEditorAssetById", () => ({
	useEditorAssetById: (resourceId: string) =>
		state.project.resources.find(({ id }) => id === resourceId),
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
	const repository = {
		readProjectFx: () => Effect.succeed(state.project),
		replaceResourceFx: (...args: ReadonlyArray<unknown>) => state.replaceResource(...args),
	};
	const provideRepositoryFn = (effect: EffectModule.Effect<unknown, unknown, unknown>) =>
		effect.pipe(
			Effect.provideService(ProjectRepository, repository as never),
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

import { useEditorAssetEditController } from "~/asset-authoring/ui/useEditorAssetEditController";

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
		version: editorTestPayload.version,
		createdAtMs: 1,
		updatedAtMs: 2,
		revision: 3,
		config: editorTestPayload.config,
		resources: editorTestPayload.resources,
	};
	state.replaceResource.mockImplementation(() => EffectModule.succeed(state.project));
	installTestPngDecoder();
	const registry = AtomRegistry.make({
		scheduleTask,
	});
	registries.push(registry);
	let controller!: useEditorAssetEditController.Output;
	const Probe = () => {
		controller = useEditorAssetEditController({
			filter: "all",
			query: "",
			resourceId: "hero",
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
		unmount: () => root.render(null),
	};
};

it.each([
	"discard",
	"unmount",
] as const)(
	"cancels asset preflight on %s before it can mutate a replacement",
	async (boundary) => {
		const editor = await mountEditor();
		const bytes = createTestPngBytes();
		let release!: (bytes: ArrayBuffer) => void;
		const arrayBuffer = vi.fn(
			() =>
				new Promise<ArrayBuffer>((resolve) => {
					release = resolve;
				}),
		);
		const file = {
			name: "replacement.png",
			size: bytes.byteLength,
			arrayBuffer,
		} as unknown as File;
		await act(async () => editor.read().setFileFn(file));
		let saving!: Promise<boolean>;
		await act(async () => {
			saving = editor.read().saveFn();
			await Promise.resolve();
		});
		expect(editor.read().saving).toBe(true);
		expect(await editor.read().saveFn()).toBe(false);
		expect(arrayBuffer).toHaveBeenCalledOnce();
		await act(async () => {
			if (boundary === "discard") state.session.discardFn();
			else editor.unmount();
			state.project = {
				...state.project,
				revision: 4,
			};
		});
		arrayBuffer.mockImplementation(async () => new Uint8Array(bytes).buffer);
		release(new Uint8Array(bytes).buffer);
		await act(async () => expect(await saving).toBe(false));
		expect(state.replaceResource).not.toHaveBeenCalled();
		expect(state.navigate).not.toHaveBeenCalled();
		if (boundary === "discard") {
			expect(editor.read().saving).toBe(false);
			expect(editor.read().dirty).toBe(false);
		}
	},
);

it("keeps an admitted rename fixed until its canonical identity is published", async () => {
	const editor = await mountEditor();
	let finish!: () => void;
	state.replaceResource.mockImplementation(({ config, currentId, resource }) =>
		EffectModule.promise(
			() =>
				new Promise<Project>((resolve) => {
					finish = () => {
						state.project = {
							...state.project,
							config,
							revision: 4,
							resources: state.project.resources.map((candidate) =>
								candidate.id === currentId ? resource : candidate,
							),
						};
						resolve(state.project);
					};
				}),
		),
	);
	await act(async () => editor.read().setNextIdFn("new-hero"));
	let saving!: Promise<boolean>;
	await act(async () => {
		saving = editor.read().saveFn();
	});
	await vi.waitFor(() => expect(state.replaceResource).toHaveBeenCalledOnce());
	await act(async () => editor.read().setNextIdFn("another-hero"));
	expect(editor.read().nextId).toBe("new-hero");
	await act(async () => {
		finish();
		expect(await saving).toBe(true);
	});
	expect(state.project.resources.some(({ id }) => id === "hero")).toBe(false);
	expect(state.navigate).toHaveBeenCalledWith(
		expect.objectContaining({
			params: {
				projectId: "project",
				resourceId: "new-hero",
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
	await act(async () => editor.read().setNextIdFn("new-hero"));
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
		expect(editor.read().nextId).toBe("hero");
		expect(editor.read().dirty).toBe(false);
	} else {
		await expect(completion).rejects.toHaveProperty("reasons.0._tag", "Die");
	}
	expect(state.navigate).not.toHaveBeenCalled();
});

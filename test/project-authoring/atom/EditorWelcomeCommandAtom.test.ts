// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { Effect as EffectModule } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EditorWelcomeCommandAtom } from "~/project-authoring/atom/EditorWelcomeCommandAtom";
import { useEditorWelcomeActions } from "~/project-authoring/ui/useEditorWelcomeActions";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const navigation = vi.hoisted(() => ({
	invalidate: vi.fn(async () => undefined),
	navigate: vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-router")>()),
	useNavigate: () => navigation.navigate,
	useRouter: () => ({
		invalidate: navigation.invalidate,
	}),
}));

vi.mock("~/application-runtime/service/RendererRuntime", async () => {
	const { Effect } = await import("effect");
	const { ProjectRepository } = await import("~/project-authoring/service/ProjectRepository");
	const repository = {
		deleteProjectFx: () => Effect.void,
	};
	return {
		RendererRuntime: {
			runSync: (effect: EffectModule.Effect<unknown, unknown, unknown>) =>
				Effect.runSync(
					effect.pipe(
						Effect.provideService(ProjectRepository, repository as never),
					) as EffectModule.Effect<unknown, unknown, never>,
				),
		},
	};
});

vi.mock("~/project-authoring/fx/createFreshProjectFx", async () => {
	const { Effect } = await import("effect");
	return {
		createFreshProjectFx: (projectId: string) =>
			Effect.succeed({
				projectId,
				title: "Created",
				version: "1.0",
				game: "created",
				createdAtMs: 1,
				updatedAtMs: 1,
			}),
	};
});

vi.mock("~/project-authoring/fx/importEditorArkpackFileFx", async () => {
	const { Effect } = await import("effect");
	return {
		importEditorArkpackFileFx: ({ file }: { readonly file: File }) =>
			file.name === "broken.arkpack"
				? Effect.fail(new Error("Broken import"))
				: Effect.succeed({
						projectId: "project-imported",
						title: "Imported",
						version: "1.0",
						game: "imported",
						createdAtMs: 2,
						updatedAtMs: 2,
					}),
	};
});

const registries: AtomRegistry.AtomRegistry[] = [];
const roots: Array<ReturnType<typeof createRoot>> = [];

const makeRegistry = () => {
	const registry = AtomRegistry.make({
		defaultIdleTTL: 400,
		scheduleTask,
	});
	registries.push(registry);
	registry.mount(EditorWelcomeCommandAtom);
	return registry;
};

const waitForState = async (
	registry: AtomRegistry.AtomRegistry,
	predicate: (state: EditorWelcomeCommandAtom.State) => boolean,
) => {
	await vi.waitFor(() => expect(predicate(registry.get(EditorWelcomeCommandAtom))).toBe(true));
	return registry.get(EditorWelcomeCommandAtom);
};

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const registry of registries.splice(0)) registry.dispose();
	navigation.invalidate.mockClear();
	navigation.navigate.mockReset();
	document.body.replaceChildren();
});

describe("EditorWelcomeCommandAtom", () => {
	it("keeps domain work and navigation settlement in one synchronous authority", async () => {
		const registry = makeRegistry();

		registry.set(EditorWelcomeCommandAtom, {
			action: "import-arkpack",
			file: new File([], "game.arkpack"),
		});
		const ready = await waitForState(registry, (state) => state.kind === "ready");
		expect(ready).toMatchObject({
			kind: "ready",
			action: "import-arkpack",
			project: {
				projectId: "project-imported",
			},
		});

		registry.set(EditorWelcomeCommandAtom, {
			action: "navigation-started",
		});
		expect(registry.get(EditorWelcomeCommandAtom)).toEqual({
			kind: "navigating",
			action: "import-arkpack",
		});

		registry.set(EditorWelcomeCommandAtom, {
			action: "create",
			projectId: "ignored-while-busy",
		});
		expect(registry.get(EditorWelcomeCommandAtom)).toEqual({
			kind: "navigating",
			action: "import-arkpack",
		});

		registry.set(EditorWelcomeCommandAtom, {
			action: "navigation-complete",
		});
		expect(registry.get(EditorWelcomeCommandAtom)).toEqual({
			kind: "idle",
		});
	});

	it("keeps navigation failures recoverable without a callback command payload", async () => {
		const registry = makeRegistry();
		registry.set(EditorWelcomeCommandAtom, {
			action: "exit",
		});
		await waitForState(registry, (state) => state.kind === "ready");
		registry.set(EditorWelcomeCommandAtom, {
			action: "navigation-started",
		});
		const error = new Error("Navigation failed");
		registry.set(EditorWelcomeCommandAtom, {
			action: "navigation-failed",
			error,
		});

		expect(registry.get(EditorWelcomeCommandAtom)).toEqual({
			kind: "error",
			error,
		});
	});

	it("settles caller-owned navigation after the welcome view unmounts", async () => {
		const registry = makeRegistry();
		let resolveNavigation: (() => void) | undefined;
		navigation.navigate.mockReturnValue(
			new Promise<void>((resolve) => {
				resolveNavigation = resolve;
			}),
		);
		const Probe = () => {
			const actions = useEditorWelcomeActions();
			return createElement(
				"button",
				{
					onClick: () => actions.createProjectFn("project-created"),
					type: "button",
				},
				actions.active ?? "idle",
			);
		};
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				createElement(
					RegistryContext.Provider,
					{
						value: registry,
					},
					createElement(Probe),
				),
			);
		});
		const button = container.querySelector("button");
		if (!(button instanceof HTMLButtonElement)) throw new Error("Probe button missing.");
		await act(async () => button.click());

		await vi.waitFor(() => expect(navigation.navigate).toHaveBeenCalledTimes(1));
		expect(navigation.navigate).toHaveBeenCalledWith({
			to: "/editor/$projectId/project/form/$sectionId",
			params: {
				projectId: "project-created",
				sectionId: "general",
			},
		});
		expect(registry.get(EditorWelcomeCommandAtom)).toEqual({
			kind: "navigating",
			action: "create",
		});

		await act(async () => root.unmount());
		roots.splice(roots.indexOf(root), 1);
		resolveNavigation?.();

		await vi.waitFor(() =>
			expect(registry.get(EditorWelcomeCommandAtom)).toEqual({
				kind: "idle",
			}),
		);
	});

	it("publishes domain failures without entering navigation", async () => {
		const registry = makeRegistry();
		registry.set(EditorWelcomeCommandAtom, {
			action: "import-arkpack",
			file: new File([], "broken.arkpack"),
		});

		const state = await waitForState(registry, (current) => current.kind === "error");
		expect(state.kind).toBe("error");
		if (state.kind !== "error") throw new Error("Expected error state.");
		expect(state.error).toBeInstanceOf(Error);
		expect((state.error as Error).message).toBe("Broken import");
	});
});

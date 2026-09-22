// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { Effect as EffectModule } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectCatalogCommandAtom } from "~/project-authoring/atom/ProjectCatalogCommandAtom";
import { useProjectCatalogActions } from "~/project-authoring/ui/useProjectCatalogActions";

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

const registries: AtomRegistry.AtomRegistry[] = [];
const roots: Array<ReturnType<typeof createRoot>> = [];

const makeRegistry = () => {
	const registry = AtomRegistry.make({
		defaultIdleTTL: 400,
		scheduleTask,
	});
	registries.push(registry);
	registry.mount(ProjectCatalogCommandAtom);
	return registry;
};

const waitForState = async (
	registry: AtomRegistry.AtomRegistry,
	predicate: (state: ProjectCatalogCommandAtom.State) => boolean,
) => {
	await vi.waitFor(() => expect(predicate(registry.get(ProjectCatalogCommandAtom))).toBe(true));
	return registry.get(ProjectCatalogCommandAtom);
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

describe("ProjectCatalogCommandAtom", () => {
	it("keeps domain work and navigation settlement in one synchronous authority", async () => {
		const registry = makeRegistry();

		registry.set(ProjectCatalogCommandAtom, {
			action: "create",
			projectId: "project-created",
		});
		const ready = await waitForState(registry, (state) => state.kind === "ready");
		expect(ready).toMatchObject({
			kind: "ready",
			action: "create",
			project: {
				projectId: "project-created",
			},
		});

		registry.set(ProjectCatalogCommandAtom, {
			action: "navigation-started",
		});
		expect(registry.get(ProjectCatalogCommandAtom)).toEqual({
			kind: "navigating",
			action: "create",
		});

		registry.set(ProjectCatalogCommandAtom, {
			action: "create",
			projectId: "ignored-while-busy",
		});
		expect(registry.get(ProjectCatalogCommandAtom)).toEqual({
			kind: "navigating",
			action: "create",
		});

		registry.set(ProjectCatalogCommandAtom, {
			action: "navigation-complete",
		});
		expect(registry.get(ProjectCatalogCommandAtom)).toEqual({
			kind: "idle",
		});
	});

	it("keeps navigation failures recoverable without a callback command payload", async () => {
		const registry = makeRegistry();
		registry.set(ProjectCatalogCommandAtom, {
			action: "create",
			projectId: "project-created",
		});
		await waitForState(registry, (state) => state.kind === "ready");
		registry.set(ProjectCatalogCommandAtom, {
			action: "navigation-started",
		});
		const error = new Error("Navigation failed");
		registry.set(ProjectCatalogCommandAtom, {
			action: "navigation-failed",
			error,
		});

		expect(registry.get(ProjectCatalogCommandAtom)).toEqual({
			kind: "error",
			error,
		});
	});

	it("settles caller-owned navigation after the game list unmounts", async () => {
		const registry = makeRegistry();
		let resolveNavigation: (() => void) | undefined;
		navigation.navigate.mockReturnValue(
			new Promise<void>((resolve) => {
				resolveNavigation = resolve;
			}),
		);
		const Probe = () => {
			const actions = useProjectCatalogActions();
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
		expect(registry.get(ProjectCatalogCommandAtom)).toEqual({
			kind: "navigating",
			action: "create",
		});

		await act(async () => root.unmount());
		roots.splice(roots.indexOf(root), 1);
		resolveNavigation?.();

		await vi.waitFor(() =>
			expect(registry.get(ProjectCatalogCommandAtom)).toEqual({
				kind: "idle",
			}),
		);
	});
});

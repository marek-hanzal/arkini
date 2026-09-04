// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import { Effect as EffectModule } from "effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Project } from "~/project-authoring/type/Project";
import { EditorTextControl } from "~/editor-control/ui/EditorValueControls";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";

const state = vi.hoisted(() => ({
	navigate: vi.fn(async () => undefined),
	project: undefined as unknown as Project,
	replaceResource: vi.fn(),
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
	useEditorUnsavedChangesRegistration: () => undefined,
}));

vi.mock("~/application-runtime/service/RendererRuntime", async () => {
	const { Effect } = await import("effect");
	const { ProjectRepository } = await import("~/project-authoring/service/ProjectRepository");
	const repository = {
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
	document.body.replaceChildren();
});

describe("useEditorAssetEditController", () => {
	it("rejects an existing asset ID at the exact field before persistence", async () => {
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
		const registry = AtomRegistry.make({
			scheduleTask,
		});
		registries.push(registry);
		const Probe = () => {
			const controller = useEditorAssetEditController({
				filter: "all",
				query: "",
				resourceId: "hero",
			});
			return createElement(
				"div",
				null,
				createElement(EditorTextControl, {
					error: controller.assetIdError,
					label: "Asset ID",
					onChangeFn: controller.setNextIdFn,
					value: controller.nextId,
				}),
				createElement(
					"button",
					{
						onClick: () => void controller.saveFn(),
						type: "button",
					},
					"Save",
				),
				controller.error === undefined
					? null
					: createElement("p", null, String(controller.error)),
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
		const input = container.querySelector<HTMLInputElement>("input");
		const save = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent === "Save",
		);
		if (input === null || save === undefined) throw new Error("Asset edit probe missing.");
		const valueSetter = Object.getOwnPropertyDescriptor(
			HTMLInputElement.prototype,
			"value",
		)?.set;
		if (valueSetter === undefined) throw new Error("Native input setter missing.");
		await act(async () => {
			valueSetter.call(input, "item-water");
			input.dispatchEvent(
				new Event("input", {
					bubbles: true,
				}),
			);
		});
		await act(async () => {
			save.click();
			await Promise.resolve();
			await Promise.resolve();
		});
		await act(
			() =>
				new Promise<void>((resolve) => {
					requestAnimationFrame(() => resolve());
				}),
		);

		expect(input.dataset.uiInvalid).toBe("true");
		expect(container.textContent).toContain(
			"Asset ID: Asset ID item-water is already used by another asset.",
		);
		expect(document.activeElement).toBe(input);
		expect(state.replaceResource).not.toHaveBeenCalled();
		expect(state.navigate).not.toHaveBeenCalled();
	});
});

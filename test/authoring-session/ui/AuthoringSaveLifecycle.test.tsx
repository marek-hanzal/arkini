// @vitest-environment jsdom

import { RegistryContext, useAtomValue } from "@effect/atom-react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import { RendererAtomRegistry } from "~/application-runtime/atom/RendererAtomRegistry";
import { EditorProjectAtom } from "~/authoring-session/atom/EditorProjectAtom";
import { useEditorProject } from "~/authoring-session/ui/useEditorProject";
import { useFormController } from "~/item-authoring/ui/useFormController";
import { useProjectFormController } from "~/project-authoring/ui/useProjectFormController";
import type { Project, ProjectCommit } from "~/project-authoring/type/Project";
import { TranslationContext } from "~/translation/ui/TranslationContext";
import {
	editorTestConfig,
	editorTestResources,
} from "~test/project-authoring/support/editorTestPayload";

let activeProjectId = "save-lifecycle";
vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => {
		const project = useAtomValue(EditorProjectAtom(activeProjectId));
		if (project === undefined) throw new Error("Missing test project.");
		return project;
	},
}));

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const cleanups: Array<() => Promise<void>> = [];
afterEach(async () => {
	for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
	vi.unstubAllGlobals();
});

const createFixture = async (kind: "item" | "project") => {
	activeProjectId = "save-lifecycle";
	const project: Project = {
		projectId: activeProjectId,
		title: editorTestConfig.meta.title,
		version: {
			major: 1,
			minor: 0,
		},
		createdAtMs: 1,
		updatedAtMs: 1,
		revision: 0,
		config: {
			...editorTestConfig,
			items: {
				...editorTestConfig.items,
				stone: {
					...editorTestConfig.items.water!,
					uid: "stone",
				},
			},
		},
		resources: editorTestResources,
	};
	const successor = {
		...project,
		projectId: "save-successor",
	};
	const releases = [
		project,
		successor,
	].map((value) => {
		const atom = EditorProjectAtom(value.projectId);
		const release = RendererAtomRegistry.mount(atom);
		RendererAtomRegistry.set(atom, {
			replacement: value,
		});
		return release;
	});
	let finishSave!: (result: unknown) => void;
	const response = new Promise<unknown>((resolve) => {
		finishSave = resolve;
	});
	const write = vi.fn(() => response);
	vi.stubGlobal("serakki", {
		editor: {
			upsertItemFn: write,
			replaceConfigFn: write,
		},
	});
	const onSavedFn = vi.fn();
	let controller!: {
		readonly editTitleFn: (title: string) => void;
		readonly saveFn: () => Promise<boolean>;
	};
	const ItemProbe = ({ itemId }: { readonly itemId: string }) => {
		const current = useEditorProject();
		const form = useFormController({
			initialItem: current.config.items[itemId]!,
			isNew: false,
			onInvalidSectionFn: () => undefined,
			onSavedFn,
		});
		controller = {
			editTitleFn: (title) => form.form.setFieldValue("title", title),
			saveFn: form.saveFn,
		};
		return null;
	};
	const ProjectProbe = () => {
		const form = useProjectFormController({
			onInvalidDestinationFn: () => undefined,
			onSavedFn,
		});
		controller = {
			editTitleFn: (title) => form.form.setFieldValue("title", title),
			saveFn: form.saveFn,
		};
		return null;
	};
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	const render = (itemId = "water") =>
		root.render(
			<RegistryContext.Provider value={RendererAtomRegistry}>
				<TranslationContext
					value={{
						textFn: (key) => key,
					}}
				>
					{kind === "item" ? <ItemProbe itemId={itemId} /> : <ProjectProbe />}
				</TranslationContext>
			</RegistryContext.Provider>,
		);
	cleanups.push(async () => {
		finishSave({
			type: "failure",
			error: {
				operation: kind === "item" ? "upsert-item" : "replace-config",
				message: "Stopped",
			},
		});
		await act(async () => root.unmount());
		for (const release of releases) release();
		container.remove();
	});
	await act(async () => render());
	await act(async () => controller.editTitleFn("Saved title"));
	let saving!: Promise<boolean>;
	await act(async () => {
		saving = controller.saveFn();
		await vi.waitFor(() => expect(write).toHaveBeenCalledOnce());
	});
	const config =
		kind === "item"
			? {
					...project.config,
					items: {
						...project.config.items,
						water: {
							...project.config.items.water!,
							title: "Saved title",
						},
					},
				}
			: {
					...project.config,
					meta: {
						...project.config.meta,
						title: "Saved title",
					},
				};
	const commit: ProjectCommit = {
		projectId: project.projectId,
		title: config.meta.title,
		version: project.version,
		createdAtMs: 1,
		updatedAtMs: 2,
		previousRevision: 0,
		revision: 1,
		config,
	};
	return {
		onSavedFn,
		project,
		finish: async () => {
			await act(async () => {
				finishSave({
					type: "success",
					value: commit,
				});
				await saving;
			});
		},
		leave: async (mode: "unmount" | "replace") => {
			await act(async () => {
				if (mode === "unmount") root.render(null);
				else {
					if (kind === "project") activeProjectId = successor.projectId;
					render("stone");
				}
			});
		},
	};
};

it.each([
	"item",
	"project",
] as const)("finishes a mounted %s save with its terminal callback", async (kind) => {
	const fixture = await createFixture(kind);
	await fixture.finish();
	expect(fixture.onSavedFn).toHaveBeenCalledOnce();
});

it.each([
	[
		"item",
		"unmount",
	],
	[
		"item",
		"replace",
	],
	[
		"project",
		"unmount",
	],
	[
		"project",
		"replace",
	],
] as const)(
	"publishes a pending %s save without its old terminal callback after %s",
	async (kind, mode) => {
		const fixture = await createFixture(kind);
		await fixture.leave(mode);
		await fixture.finish();
		expect(
			RendererAtomRegistry.get(EditorProjectAtom(fixture.project.projectId))?.revision,
		).toBe(1);
		expect(fixture.onSavedFn).not.toHaveBeenCalled();
	},
);

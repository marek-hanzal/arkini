// @vitest-environment jsdom
import { RegistryContext } from "@effect/atom-react";
import { RendererAtomRegistry } from "~/application-runtime/atom/RendererAtomRegistry";
import { EditorUnsavedChangesOwnerAtom } from "~/authoring-session/atom/EditorUnsavedChangesOwnerAtom";
import { Effect } from "effect";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import type { Project } from "~/project-authoring/type/Project";
const state = vi.hoisted(() => ({
	project: undefined as unknown as Project,
	save: vi.fn(),
	navigate: vi.fn(),
}));
vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => state.navigate,
}));
vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));
vi.mock("~/game-config-resource/fx/saveEditorResourceMetadataFx", () => ({
	saveEditorResourceMetadataFx: (props: unknown) => state.save(props),
}));
import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import { EditorUnsavedChanges } from "~/authoring-session/service/EditorUnsavedChanges";
import { useEditorResourceMetadataEditController } from "~/resource-authoring/ui/useEditorResourceMetadataEditController";
import {
	editorTestConfig,
	editorTestResources,
} from "~test/project-authoring/support/editorTestPayload";
(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;
it("saves an image title against its draft revision without changing UID or navigating", async () => {
	const resource = {
		...editorTestResources[0]!,
		type: "image" as const,
		title: "Original image",
	};
	state.project = {
		projectId: "project",
		title: "Project",
		version: {
			major: 1,
			minor: 0,
		},
		createdAtMs: 1,
		updatedAtMs: 1,
		revision: 3,
		config: editorTestConfig,
		resources: [
			resource,
		],
	};
	let finish!: () => void;
	state.save.mockImplementation(() =>
		Effect.promise(
			() =>
				new Promise<Project>((resolve) => {
					finish = () =>
						resolve({
							...state.project,
							revision: 4,
						});
				}),
		),
	);
	const closeFn = vi.fn();
	let controller!: useEditorResourceMetadataEditController.Output;
	const Probe = () => {
		controller = useEditorResourceMetadataEditController({
			resource,
			type: "image",
			closeFn,
		});
		return null;
	};
	const root = createRoot(document.createElement("div"));
	const unsaved = RendererRuntime.runSync(EditorUnsavedChanges);
	RendererAtomRegistry.set(EditorUnsavedChangesOwnerAtom, unsaved);
	try {
		await act(async () =>
			root.render(
				<RegistryContext.Provider value={RendererAtomRegistry}>
					<Probe />
				</RegistryContext.Provider>,
			),
		);
		await act(async () => controller.setTitleFn("New image"));
		let closing!: Promise<void>;
		await act(async () => {
			closing = controller.requestCloseFn();
		});
		expect(unsaved.getSnapshotFn().promptOpen).toBe(true);
		await act(async () => {
			await unsaved.decideFn("cancel");
			await closing;
		});
		expect(closeFn).not.toHaveBeenCalled();
		expect(controller.title).toBe("New image");

		let saving!: Promise<boolean>;
		await act(async () => {
			saving = controller.saveFn();
		});
		await vi.waitFor(() =>
			expect(state.save).toHaveBeenCalledWith({
				projectId: "project",
				expectedRevision: 3,
				resourceUid: resource.uid,
				title: "New image",
			}),
		);
		await act(async () => controller.setTitleFn("Late change"));
		expect(controller.title).toBe("New image");
		await act(async () => {
			finish();
			expect(await saving).toBe(true);
		});
		expect(closeFn).toHaveBeenCalledOnce();
		expect(state.navigate).not.toHaveBeenCalled();
		expect(state.project.config).toBe(editorTestConfig);
		await act(async () => controller.setTitleFn("Discard me"));
		await act(async () => {
			closing = controller.requestCloseFn();
		});
		await act(async () => {
			await unsaved.decideFn("discard");
			await closing;
		});
		expect(closeFn).toHaveBeenCalledTimes(2);
		expect(controller.title).toBe("Original image");
	} finally {
		await act(async () => root.unmount());
	}
});

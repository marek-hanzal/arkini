// @vitest-environment jsdom

import { Effect } from "effect";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

const boundary = vi.hoisted(() => ({
	runPromiseFn: vi.fn(),
}));
vi.mock("~/application-runtime/service/RendererRuntime", () => ({
	RendererRuntime: {
		runPromise: boundary.runPromiseFn,
	},
}));
vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		projectId: "project-one",
	}),
}));
vi.mock("~/project-version/ui/useVersionCheckout", () => ({
	useVersionCheckout: () => ({}),
}));

import { ProjectRepository } from "~/project-authoring/service/ProjectRepository";
import type { ProjectVersionDescriptor } from "~/project-version/type/ProjectVersion";
import { useVersionHistoryController } from "~/project-version/ui/useVersionHistoryController";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

it("preserves explicit Version comparison and tag drafts through MCP refresh while following HEAD in working-copy mode", async () => {
	let changedFn!: (projectId: string) => void;
	Object.defineProperty(window, "arkini", {
		configurable: true,
		value: {
			editor: {
				onProjectChangedFn: (listenerFn: typeof changedFn) => {
					changedFn = listenerFn;
					return () => undefined;
				},
			},
		},
	});
	let version: ProjectVersionDescriptor = {
		versionId: "version-one",
		subject: "Initial",
		createdAtMs: 1,
		arkpackVersion: "1.0",
		tag: "Published",
		arkini: "1.0",
		projectId: "project-one",
		sourceRevision: 1,
	};
	const second: ProjectVersionDescriptor = {
		...version,
		versionId: "version-two",
		parentVersionId: "version-one",
		tag: "Second",
	};
	let currentBaseVersionId = version.versionId;
	const repository = {
		awaitIdleFx: Effect.void,
		readVersionStatusFx: () =>
			Effect.succeed({
				canCommit: true,
				currentBaseVersionId,
				currentFingerprint: "a".repeat(64),
				dirty: false,
				versionCount: 2,
			}),
		listVersionsFx: () =>
			Effect.succeed([
				{
					...second,
				},
				{
					...version,
				},
			]),
		diffVersionsFx: () =>
			Effect.succeed({
				hasChanges: false,
				project: [],
				items: [],
				resources: [],
				scenarios: [],
			}),
		updateVersionTagFx: ({ tag }: { readonly tag?: string }) =>
			Effect.sync(() => {
				const { tag: _oldTag, ...descriptor } = version;
				version = {
					...descriptor,
					...(tag === undefined
						? {}
						: {
								tag: tag.trim(),
							}),
				};
			}),
	};
	boundary.runPromiseFn.mockImplementation((effect) =>
		Effect.runPromise(
			effect.pipe(Effect.provideService(ProjectRepository, repository as never)),
		),
	);
	let controller!: useVersionHistoryController.Output;
	const Probe = () => {
		controller = useVersionHistoryController();
		return null;
	};
	const host = document.createElement("div");
	document.body.append(host);
	const root = createRoot(host);
	try {
		await act(async () => root.render(createElement(Probe)));
		expect(controller.compareFrom).toBe("version-one");
		await act(async () => controller.selectVersionFn("version-one"));
		await act(async () => controller.setTagDraftFn("Unsubmitted release label"));
		await act(async () => changedFn("project-one"));
		expect(controller.selected?.versionId).toBe("version-one");
		expect(controller.tagDraft).toBe("Unsubmitted release label");

		currentBaseVersionId = "version-two";
		await act(async () => changedFn("project-one"));
		expect(controller.compareFrom).toBe("version-one");
		expect(controller.compareTo).toBe("version-one");
		expect(controller.tagDraft).toBe("Unsubmitted release label");
		await act(async () => controller.saveTagFn());
		expect(version.tag).toBe("Unsubmitted release label");
		expect(controller.selected?.versionId).toBe("version-one");
		expect(controller.tagPending).toBe(false);

		await act(async () => controller.selectVersionFn("version-two"));
		expect(controller.tagDraft).toBe("Second");
		await act(async () => controller.selectWorkingCopyFn());
		expect(controller.selected).toBeUndefined();
		expect(controller.tagDraft).toBe("");
		expect(controller.compareFrom).toBe("version-two");
		expect(controller.compareTo).toBe("current");
		currentBaseVersionId = "version-one";
		await act(async () => changedFn("project-one"));
		expect(controller.compareFrom).toBe("version-one");
	} finally {
		await act(async () => root.unmount());
		host.remove();
		Reflect.deleteProperty(window, "arkini");
	}
});

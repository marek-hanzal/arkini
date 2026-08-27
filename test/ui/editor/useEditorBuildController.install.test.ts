// @vitest-environment jsdom

import { Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createArtifact } from "./EditorBuild.test/fixtures";

const state = vi.hoisted(() => ({
	buildResult: undefined as unknown,
	catalogState: undefined as unknown,
	install: vi.fn(),
	project: undefined as unknown,
}));

vi.mock("@effect/atom-react", () => ({
	useAtomSet: (atom: { readonly kind: string }) =>
		atom.kind === "install" ? state.install : vi.fn(),
	useAtomValue: (atom: { readonly kind: string }) =>
		atom.kind === "build"
			? state.buildResult
			: atom.kind === "catalog"
				? state.catalogState
				: AsyncResult.initial(),
}));

vi.mock("~/bridge/arkpack/ArkpackCatalogAtom", () => ({
	ArkpackCatalogAtom: {
		kind: "catalog",
	},
}));

vi.mock("~/bridge/arkpack/editor/buildEditorProjectCommandAtom", () => ({
	buildEditorProjectCommandAtom: () => ({
		kind: "build",
	}),
}));

vi.mock("~/bridge/arkpack/editor/installBuiltEditorArkpackCommandAtom", () => ({
	installBuiltEditorArkpackCommandAtom: () => ({
		kind: "install",
	}),
}));

vi.mock("~/bridge/arkpack/editor/saveBuiltEditorArkpackCommandAtom", () => ({
	saveBuiltEditorArkpackCommandAtom: () => ({
		kind: "save",
	}),
}));

vi.mock("~/bridge/editor/exportEditorJsonDirectoryCommandAtom", () => ({
	exportEditorJsonDirectoryCommandAtom: () => ({
		kind: "export",
	}),
}));

vi.mock("~/bridge/editor/openEditorExportDirectoryCommandAtom", () => ({
	openEditorExportDirectoryCommandAtom: {
		kind: "open-export",
	},
}));

vi.mock("~/bridge/editor/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));

vi.mock("~/bridge/runtime/RendererRuntime", () => ({
	RendererRuntime: {
		runSync: Effect.runSync,
	},
}));

import { useEditorBuildController } from "~/ui/arkpack/editor/useEditorBuildController";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
let controller: useEditorBuildController.Output | undefined;

beforeEach(() => {
	controller = undefined;
	state.install.mockReset();
	state.install.mockResolvedValue(undefined);
	state.project = {
		projectId: "editor-test",
		title: "Editor test",
		config: {
			items: {},
		},
		resources: [],
		revision: 0,
		version: "1.0",
	};
	state.buildResult = AsyncResult.success(createArtifact("b".repeat(64), 0));
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const renderController = async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	const Probe = () => {
		controller = useEditorBuildController();
		return null;
	};
	await act(async () => root.render(createElement(Probe)));
};

const installedDescriptor = (version: string, source: "bundled" | "user") => ({
	packageId: "editor-test",
	contentHash: "a".repeat(64),
	title: "Existing",
	version,
	arkini: "1.0.0",
	trust: {
		type: "external" as const,
	},
	source,
});

describe("useEditorBuildController install confirmation", () => {
	it("keeps a major bundled-package update cancellable before command admission", async () => {
		state.catalogState = {
			type: "ready",
			arkpacks: [
				installedDescriptor("2.0", "bundled"),
			],
		};
		await renderController();

		await act(async () => controller?.installArtifact());
		expect(controller?.installAction).toBe("update");
		expect(controller?.installConfirmation).toBeDefined();
		expect(state.install).not.toHaveBeenCalled();

		await act(async () => controller?.cancelInstall());
		expect(controller?.installConfirmation).toBeUndefined();
		expect(state.install).not.toHaveBeenCalled();

		await act(async () => controller?.installArtifact());
		const confirmation = controller?.installConfirmation;
		await act(async () => controller?.confirmInstall());
		expect(state.install).toHaveBeenCalledWith({
			artifact: createArtifact("b".repeat(64), 0),
			confirmation,
			targetVersion: "1.0",
		});
	});

	it("admits a same-major user-package update without confirmation", async () => {
		state.catalogState = {
			type: "ready",
			arkpacks: [
				installedDescriptor("1.9", "user"),
			],
		};
		await renderController();
		const artifact = createArtifact("b".repeat(64), 0);

		await act(async () => controller?.installArtifact());

		expect(controller?.installConfirmation).toBeUndefined();
		expect(state.install).toHaveBeenCalledWith({
			artifact,
			targetVersion: "1.0",
		});
	});
});

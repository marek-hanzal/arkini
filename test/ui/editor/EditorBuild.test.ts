// @vitest-environment jsdom

import { Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { act, createElement, type AnchorHTMLAttributes, type ButtonHTMLAttributes } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createArtifact } from "./EditorBuild.test/fixtures";

const state = vi.hoisted(() => ({
	buildResult: undefined as unknown,
	commandSetters: new Map<string, ReturnType<typeof vi.fn>>(),
	exportResults: new Map<string, unknown>(),
	installResults: new Map<string, unknown>(),
	project: undefined as unknown,
}));

vi.mock("@effect/atom-react", () => ({
	useAtomSet: (atom: {
		readonly kind: "build" | "export" | "install" | "open-export" | "save";
		readonly key: string;
	}) => {
		const key = `${atom.kind}:${atom.key}`;
		const current = state.commandSetters.get(key);
		if (current !== undefined) return current;
		const setter = vi.fn();
		state.commandSetters.set(key, setter);
		return setter;
	},
	useAtomValue: (atom: {
		readonly kind: "build" | "export" | "install" | "open-export" | "save";
		readonly key: string;
	}) =>
		atom.kind === "build"
			? state.buildResult
			: atom.kind === "install"
				? (state.installResults.get(atom.key) ?? AsyncResult.initial())
				: atom.kind === "export"
					? (state.exportResults.get(atom.key) ?? AsyncResult.initial())
					: AsyncResult.initial(),
}));

vi.mock("~/bridge/arkpack/editor/buildEditorProjectCommandAtom", () => ({
	buildEditorProjectCommandAtom: (projectId: string) => ({
		kind: "build",
		key: projectId,
	}),
}));

vi.mock("~/bridge/arkpack/editor/installBuiltEditorArkpackCommandAtom", () => ({
	installBuiltEditorArkpackCommandAtom: (contentHash: string) => ({
		kind: "install",
		key: contentHash,
	}),
}));

vi.mock("~/bridge/arkpack/editor/saveBuiltEditorArkpackCommandAtom", () => ({
	saveBuiltEditorArkpackCommandAtom: (contentHash: string) => ({
		kind: "save",
		key: contentHash,
	}),
}));

vi.mock("~/bridge/editor/exportEditorJsonDirectoryCommandAtom", () => ({
	exportEditorJsonDirectoryCommandAtom: (projectId: string) => ({
		kind: "export",
		key: projectId,
	}),
}));

vi.mock("~/bridge/editor/openEditorExportDirectoryCommandAtom", () => ({
	openEditorExportDirectoryCommandAtom: {
		kind: "open-export",
		key: "completed-export",
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

vi.mock("~/ui/editor/EditorHistoryBackButton", () => ({
	EditorHistoryBackButton: () => createElement("span"),
}));

vi.mock("~/ui/button/Button", () => ({
	Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) =>
		createElement("button", props, children),
	PrimaryButton: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) =>
		createElement("button", props, children),
	ButtonLink: ({
		children,
		to,
		params,
		...props
	}: AnchorHTMLAttributes<HTMLAnchorElement> & {
		readonly to: string;
		readonly params: Record<string, string>;
	}) =>
		createElement(
			"a",
			{
				...props,
				href: Object.entries(params).reduce(
					(path, [key, value]) => path.replace(`$${key}`, value),
					to,
				),
			},
			children,
		),
}));

import { EditorBuild } from "~/ui/arkpack/editor/EditorBuild";
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
	state.buildResult = AsyncResult.initial();
	state.commandSetters.clear();
	state.exportResults.clear();
	state.installResults.clear();
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const renderBuild = async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	const render = async () => {
		await act(async () => {
			root.render(createElement(EditorBuild));
		});
	};
	await render();
	return {
		container,
		render,
	};
};

const renderController = async () => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	const Probe = () => {
		controller = useEditorBuildController();
		return null;
	};
	const render = async () => {
		await act(async () => root.render(createElement(Probe)));
	};
	await render();
	return render;
};

describe("EditorBuild", () => {
	it("hides an artifact as soon as the canonical project revision changes", async () => {
		state.buildResult = AsyncResult.success(createArtifact("a".repeat(64), 0));
		const render = await renderController();
		expect(controller?.buildStatus).toBe("valid");
		expect(controller?.artifactSummary).toBeDefined();

		state.project = {
			...(state.project as Record<string, unknown>),
			revision: 1,
		};
		await render();
		expect(controller?.buildStatus).toBe("stale");
		expect(controller?.artifactSummary).toBeUndefined();
	});

	it("does not show an install result from a different artifact hash", async () => {
		const firstHash = "a".repeat(64);
		const secondHash = "b".repeat(64);
		state.buildResult = AsyncResult.success(createArtifact(firstHash, 0));
		state.installResults.set(
			firstHash,
			AsyncResult.success({
				packageId: firstHash,
			}),
		);
		const render = await renderController();
		expect(controller?.installedPackageId).toBe(firstHash);

		state.buildResult = AsyncResult.success(createArtifact(secondHash, 0));
		await render();
		expect(controller?.installedPackageId).toBeUndefined();
	});

	it("sends the exact current artifact to both output actions", async () => {
		const artifact = createArtifact("a".repeat(64), 0);
		state.buildResult = AsyncResult.success(artifact);
		const { container } = await renderBuild();

		await act(async () => {
			container.querySelector<HTMLElement>('[data-ui="EditorBuildSave"]')?.click();
			container.querySelector<HTMLElement>('[data-ui="EditorBuildInstall"]')?.click();
		});

		expect(state.commandSetters.get(`save:${artifact.contentHash}`)).toHaveBeenCalledWith(
			artifact,
		);
		expect(state.commandSetters.get(`install:${artifact.contentHash}`)).toHaveBeenCalledWith(
			artifact,
		);
	});

});

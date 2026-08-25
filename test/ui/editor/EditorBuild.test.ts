// @vitest-environment jsdom

import { Effect } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { act, createElement, type AnchorHTMLAttributes, type ButtonHTMLAttributes } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { capacityDiagnostic, createArtifact } from "./EditorBuild.test/fixtures";

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

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
beforeEach(() => {
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

describe("EditorBuild", () => {
	it("requires an explicit build before presenting a valid artifact", async () => {
		const { container } = await renderBuild();

		expect(container.textContent).toContain("Not built");
		expect(container.textContent).toContain("Run a build to execute the complete game");
		expect(container.textContent).toContain("Build arkpack");
	});

	it("exports source independently and reveals the completed output folder", async () => {
		const { container, render } = await renderBuild();

		expect(container.textContent).toContain("JSON source export");
		expect(container.textContent).toContain("current schema.json");
		expect(container.textContent).not.toContain("entire contents");
		expect(container.textContent).not.toContain("every existing file and subfolder");
		expect(
			container.querySelector<HTMLElement>('[data-ui="EditorBuildExportSource"]')
				?.textContent,
		).toBe("Export");
		expect(container.textContent).not.toContain("Open folder");
		await act(async () => {
			container.querySelector<HTMLElement>('[data-ui="EditorBuildExportSource"]')?.click();
		});
		expect(state.commandSetters.get("export:editor-test")).toHaveBeenCalledWith(undefined);

		state.exportResults.set(
			"editor-test",
			AsyncResult.success({
				json: 9,
				projectDirectory: "/tmp/source",
				resources: 3,
				revision: 4,
				root: "/tmp/source",
			}),
		);
		await render();
		expect(container.textContent).toContain(
			"Exported revision 4: 9 JSON files and 3 PNG resources to /tmp/source.",
		);
		expect(container.textContent).toContain("Open folder");

		state.exportResults.set("editor-test", AsyncResult.success(null));
		await render();
		expect(container.textContent).toContain(
			"Exported revision 4: 9 JSON files and 3 PNG resources to /tmp/source.",
		);
		expect(container.textContent).toContain("Open folder");
		await act(async () => {
			container
				.querySelector<HTMLElement>('[data-ui="EditorBuildOpenSourceExport"]')
				?.click();
		});
		expect(state.commandSetters.get("open-export:completed-export")).toHaveBeenCalledWith(
			undefined,
		);
	});

	it("hides an artifact as soon as the canonical project revision changes", async () => {
		state.buildResult = AsyncResult.success(createArtifact("a".repeat(64), 0));
		const { container, render } = await renderBuild();
		expect(container.textContent).toContain("Valid");
		expect(container.textContent).toContain("Build output");

		state.project = {
			...(state.project as Record<string, unknown>),
			revision: 1,
		};
		await render();
		expect(container.textContent).toContain("Stale");
		expect(container.textContent).not.toContain("Build output");
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
		const { container, render } = await renderBuild();
		expect(container.textContent).toContain(`Installed as ${firstHash}`);

		state.buildResult = AsyncResult.success(createArtifact(secondHash, 0));
		await render();
		expect(container.textContent).not.toContain(`Installed as ${firstHash}`);
		expect(container.textContent).not.toContain("Installed as");
	});

	it("uses concise output actions and a human-readable artifact size", async () => {
		state.buildResult = AsyncResult.success(createArtifact("a".repeat(64), 0));
		const { container } = await renderBuild();

		expect(container.textContent).toContain("2 bytes");
		expect(container.textContent).not.toContain("Install to game catalog");
		expect(container.querySelector("button")?.textContent).not.toBe("Install");
		expect(
			Array.from(container.querySelectorAll("button"), (button) => button.textContent),
		).toContain("Install");
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

	it("renders actionable structured diagnostics instead of a code-only message", async () => {
		state.project = {
			...(state.project as Record<string, unknown>),
			config: {
				items: {
					"producer:academy": {
						uid: "academy-uid",
						title: "Academy",
					},
				},
			},
		};
		state.buildResult = AsyncResult.success({
			...createArtifact("a".repeat(64), 0),
			diagnostics: [
				capacityDiagnostic,
			],
		});

		const { container } = await renderBuild();

		expect(container.textContent).toContain("Unsupported input capacity");
		expect(container.textContent).toContain(
			"This input buffer is only supported by producer lines.",
		);
		expect(container.querySelector("a")?.getAttribute("href")).toBe(
			"/editor/editor-test/editor/items/academy-uid/form/production",
		);
	});
});

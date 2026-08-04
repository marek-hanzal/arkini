// @vitest-environment jsdom

import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { act, createElement, type ButtonHTMLAttributes } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	buildResult: undefined as unknown,
	installResults: new Map<string, unknown>(),
	project: undefined as unknown,
}));

vi.mock("@effect/atom-react", () => ({
	useAtomSet: () => vi.fn(),
	useAtomValue: (atom: { readonly kind: "build" | "install"; readonly key: string }) =>
		atom.kind === "build"
			? state.buildResult
			: (state.installResults.get(atom.key) ?? AsyncResult.initial()),
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
		kind: "install",
		key: `save:${contentHash}`,
	}),
}));

vi.mock("~/bridge/editor/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));

vi.mock("~/ui/button/Button", () => ({
	Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) =>
		createElement("button", props, children),
	PrimaryButton: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) =>
		createElement("button", props, children),
}));

import { EditorBuild } from "~/ui/arkpack/editor/EditorBuild";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const createArtifact = (contentHash: string, revision: number) => ({
	bytes: new Uint8Array([
		1,
		2,
	]),
	contentHash,
	diagnostics: [],
	filename: "editor-test.arkpack",
	revision,
});

beforeEach(() => {
	state.project = {
		projectId: "editor-test",
		title: "Editor test",
		config: {
			items: {},
		},
		revision: 0,
	};
	state.buildResult = AsyncResult.initial();
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
});

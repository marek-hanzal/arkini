// @vitest-environment jsdom

import { RegistryContext, scheduleTask } from "@effect/atom-react";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { act, createElement, Fragment } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EditorWelcomeCommandAtom } from "~/ui/editor/EditorWelcomeCommandAtom";
import { useEditorWelcomeActions } from "~/ui/editor/useEditorWelcomeActions";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const deletion = vi.hoisted(() => ({
	run: vi.fn(),
}));
const navigation = vi.hoisted(() => ({
	invalidate: vi.fn<() => Promise<void>>(),
	navigate: vi.fn(async () => undefined),
	router: undefined as unknown as {
		readonly invalidate: () => Promise<void>;
	},
}));
navigation.router = {
	invalidate: navigation.invalidate,
};

vi.mock("@tanstack/react-router", async (importOriginal) => ({
	...(await importOriginal<typeof import("@tanstack/react-router")>()),
	useNavigate: () => navigation.navigate,
	useRouter: () => navigation.router,
}));

vi.mock("~/bridge/editor/deleteEditorProjectAtom", async () => {
	const { Effect } = await import("effect");
	const Atom = await import("effect/unstable/reactivity/Atom");
	return {
		deleteEditorProjectAtom: Atom.fn((projectId: string) =>
			Effect.sync(() => deletion.run(projectId)),
		),
	};
});

vi.mock("~/bridge/editor/createFreshEditorProjectAtom", async () => {
	const { Effect } = await import("effect");
	const Atom = await import("effect/unstable/reactivity/Atom");
	return {
		createFreshEditorProjectAtom: Atom.fn(() => Effect.die("Unexpected create.")),
	};
});

vi.mock("~/bridge/arkpack/editor/importEditorArkpackFileAtom", async () => {
	const { Effect } = await import("effect");
	const Atom = await import("effect/unstable/reactivity/Atom");
	return {
		importEditorArkpackFileAtom: Atom.fn(() => Effect.die("Unexpected arkpack import.")),
	};
});

vi.mock("~/bridge/editor/importEditorJsonDirectoryAtom", async () => {
	const { Effect } = await import("effect");
	const Atom = await import("effect/unstable/reactivity/Atom");
	return {
		importEditorJsonDirectoryAtom: Atom.fn(() => Effect.die("Unexpected JSON import.")),
	};
});

const registries: AtomRegistry.AtomRegistry[] = [];
const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	for (const registry of registries.splice(0)) registry.dispose();
	deletion.run.mockReset();
	navigation.invalidate.mockReset();
	navigation.navigate.mockClear();
	document.body.replaceChildren();
});

describe("editor project deletion lifecycle", () => {
	it("keeps a committed deletion final when Recent refresh fails and retries only refresh", async () => {
		const refreshFailure = new Error("Recent loader failed");
		deletion.run
			.mockImplementationOnce(() => undefined)
			.mockImplementationOnce(() => {
				throw new Error("Second delete failed");
			});
		navigation.invalidate
			.mockRejectedValueOnce(refreshFailure)
			.mockResolvedValueOnce(undefined);
		const registry = AtomRegistry.make({
			defaultIdleTTL: 400,
			scheduleTask,
		});
		registries.push(registry);
		registry.mount(EditorWelcomeCommandAtom);

		const Probe = () => {
			const actions = useEditorWelcomeActions();
			return createElement(
				Fragment,
				null,
				createElement(
					"button",
					{
						id: "delete-project",
						onClick: () => actions.deleteProject("project-one"),
						type: "button",
					},
					"Delete",
				),
				createElement(
					"button",
					{
						id: "delete-second-project",
						onClick: () => actions.deleteProject("project-two"),
						type: "button",
					},
					"Delete second",
				),
				createElement(
					"button",
					{
						disabled: actions.refreshingProjects,
						id: "refresh-projects",
						onClick: () => void actions.refreshProjects(),
						type: "button",
					},
					"Refresh",
				),
				createElement(
					"output",
					null,
					[
						actions.active ?? "idle",
						actions.deletedProjectIds.has("project-one") ? "hidden" : "visible",
						actions.projectRefreshError === undefined ? "clean" : "refresh-error",
						actions.error === undefined ? "command-clean" : "command-error",
					].join("|"),
				),
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

		const deleteButton = container.querySelector("#delete-project");
		if (!(deleteButton instanceof HTMLButtonElement)) throw new Error("Delete missing.");
		await act(async () => deleteButton.click());
		await vi.waitFor(() =>
			expect(container.querySelector("output")?.textContent).toBe(
				"idle|hidden|refresh-error|command-clean",
			),
		);
		expect(deletion.run).toHaveBeenCalledOnce();
		expect(deletion.run).toHaveBeenCalledWith("project-one");
		expect(navigation.invalidate).toHaveBeenCalledOnce();
		const deleteSecondButton = container.querySelector("#delete-second-project");
		if (!(deleteSecondButton instanceof HTMLButtonElement))
			throw new Error("Second delete missing.");
		await act(async () => deleteSecondButton.click());
		await vi.waitFor(() =>
			expect(container.querySelector("output")?.textContent).toBe(
				"idle|hidden|refresh-error|command-error",
			),
		);
		expect(deletion.run).toHaveBeenCalledTimes(2);
		expect(deletion.run).toHaveBeenLastCalledWith("project-two");
		expect(navigation.invalidate).toHaveBeenCalledOnce();

		const refreshButton = container.querySelector("#refresh-projects");
		if (!(refreshButton instanceof HTMLButtonElement)) throw new Error("Refresh missing.");
		await act(async () => refreshButton.click());
		await vi.waitFor(() =>
			expect(container.querySelector("output")?.textContent).toBe(
				"idle|visible|clean|command-error",
			),
		);
		expect(navigation.invalidate).toHaveBeenCalledTimes(2);
		expect(deletion.run).toHaveBeenCalledTimes(2);
	});
});

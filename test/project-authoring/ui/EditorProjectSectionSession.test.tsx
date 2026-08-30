import { Effect } from "effect";
// @vitest-environment jsdom

import { act, createElement, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@effect/atom-react", () => ({
	scheduleTask: vi.fn(),
	useAtomSet: () => state.saveConfig,
	useAtomValue: () => undefined,
}));

vi.mock("~/authoring-session/ui/useEditorUnsavedChangesRegistration", () => ({
	useEditorUnsavedChangesRegistration: () => undefined,
}));

vi.mock("~/authoring-shell/ui/EditorHistoryBackButton", () => ({
	EditorHistoryBackButton: () => createElement("span"),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const original = await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...original,
		Outlet: () => state.section,
		useNavigate: () => vi.fn().mockResolvedValue(undefined),
	};
});

vi.mock("~/ui/button/Button", () => ({
	Button: ({ children, type = "button", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) =>
		createElement(
			"button",
			{
				...props,
				type,
			},
			children,
		),
	ButtonLink: ({ children }: { readonly children?: ReactNode }) =>
		createElement("a", null, children),
	PrimaryButton: ({
		children,
		type = "button",
		...props
	}: ButtonHTMLAttributes<HTMLButtonElement>) =>
		createElement(
			"button",
			{
				...props,
				type,
			},
			children,
		),
}));

const state = vi.hoisted(() => ({
	project: undefined as unknown,
	saveConfig: vi.fn().mockResolvedValue(undefined),
	section: undefined as ReactNode,
}));

interface TestStartGridCell {
	readonly itemId: string;
	readonly quantity: number;
	readonly x: number;
	readonly y: number;
}

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));

vi.mock("~/ui/reactivity/readSettledAsyncResultErrorFx", () => ({
	readSettledAsyncResultErrorFx: () => Effect.succeed(undefined),
}));

vi.mock("~/asset-authoring/ui/EditorAssetAutocompleteField", () => ({
	EditorAssetAutocompleteField: ({ label }: { readonly label: string }) =>
		createElement("span", null, label),
}));

vi.mock("~/authoring-form/ui/EditorItemAutocompleteField", () => ({
	EditorItemAutocompleteField: ({ label }: { readonly label: string }) =>
		createElement("span", null, label),
}));

vi.mock("~/project-authoring/ui/EditorProjectStartGrid", () => ({
	EditorProjectStartGrid: ({
		cells,
		onCellsChange,
	}: {
		readonly cells: ReadonlyArray<TestStartGridCell>;
		readonly onCellsChange: (cells: ReadonlyArray<TestStartGridCell>) => void;
	}) =>
		createElement(
			"button",
			{
				"data-cells": cells
					.map(({ itemId, quantity, x, y }) => `${itemId}:${quantity}:${x}:${y}`)
					.join("|"),
				"data-ui": "EditorProjectStartGrid",
				onClick: () =>
					onCellsChange(
						cells.map((cell) => ({
							...cell,
							quantity: cell.quantity + 1,
						})),
					),
				type: "button",
			},
			"Edit selected space",
		),
}));

import type { EditorProject } from "~/project-authoring/type/EditorProject";
import { Route as EditorProjectFormRouteDefinition } from "~/@routes/editor/$projectId/project";
import { EditorProjectBoardSection } from "~/project-authoring/ui/EditorProjectBoardSection";
import { EditorProjectGeneralSection } from "~/project-authoring/ui/EditorProjectGeneralSection";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { boardSpaceProject } from "~test/project-authoring/support/BoardSpaceProject";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const EditorProjectForm = EditorProjectFormRouteDefinition.options.component;
if (EditorProjectForm === undefined)
	throw new Error("Editor project form route component is missing.");

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
	state.saveConfig.mockReset().mockResolvedValue(undefined);
});

const changeInput = async (input: HTMLInputElement, value: string) => {
	const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
	if (valueSetter === undefined) throw new Error("Expected native input value setter.");
	await act(async () => {
		valueSetter.call(input, value);
		input.dispatchEvent(
			new Event("input", {
				bubbles: true,
			}),
		);
	});
};

describe("project section form session", () => {
	it("preserves one local project draft while routed section content changes", async () => {
		state.project = {
			projectId: "project",
			title: editorTestPayload.config.meta.title,
			version: editorTestPayload.version,
			createdAtMs: 1,
			updatedAtMs: 2,
			revision: 0,
			config: editorTestPayload.config,
			resources: editorTestPayload.resources,
		} satisfies EditorProject;
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const renderSection = async (section: ReactNode) => {
			state.section = section;
			await act(async () => {
				root.render(createElement(EditorProjectForm));
			});
		};

		await renderSection(<EditorProjectGeneralSection />);
		const navigation = container.querySelector('[data-ui="EditorSectionNavigation"]');
		const compatibility = container.querySelector<HTMLElement>(
			'[data-ui="EditorCompatibilityNotice"]',
		);
		expect(compatibility?.dataset.uiResult).toBe("noop");
		const title = container.querySelector<HTMLInputElement>('input[name="title"]');
		if (title === null) throw new Error("Missing project title input.");
		await changeInput(title, "Changed project");
		expect(container.querySelector('[data-ui="EditorCompatibilityNotice"]')).toBe(
			compatibility,
		);
		expect(compatibility?.dataset.uiResult).toBe("minor");
		await renderSection(<div data-ui="AppearanceSection">Appearance</div>);
		await renderSection(<EditorProjectGeneralSection />);

		expect(container.querySelector('[data-ui="EditorSectionNavigation"]')).toBe(navigation);
		expect(container.querySelector<HTMLInputElement>('input[name="title"]')?.value).toBe(
			"Changed project",
		);
	});

	it("submits one complete config without losing unrelated facts or exact start stacks", async () => {
		const project = {
			...boardSpaceProject,
			config: {
				...boardSpaceProject.config,
				meta: {
					...boardSpaceProject.config.meta,
					toolbarSize: 2,
				},
				resources: {
					hero: "hero",
					"avatar-03": "item-water",
				},
				start: {
					...boardSpaceProject.config.start,
					inventory: [
						{
							itemId: "water",
							position: {
								x: 0,
								y: 0,
							},
							quantity: 3,
						},
					],
					toolbar: [
						{
							itemId: "water",
							position: {
								x: 1,
								y: 0,
							},
							quantity: 4,
						},
					],
				},
			},
		} satisfies EditorProject;
		state.project = project;
		state.section = <EditorProjectGeneralSection />;
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(createElement(EditorProjectForm));
		});

		const title = container.querySelector<HTMLInputElement>('input[name="title"]');
		const form = container.querySelector("form");
		if (title === null || form === null) throw new Error("Missing project form controls.");
		await changeInput(title, "Updated project");
		await act(async () => {
			form.dispatchEvent(
				new SubmitEvent("submit", {
					bubbles: true,
					cancelable: true,
				}),
			);
			await Promise.resolve();
		});

		expect(state.saveConfig).toHaveBeenCalledTimes(1);
		const [{ config, expectedRevision }] = state.saveConfig.mock.calls[0] ?? [];
		expect(expectedRevision).toBe(project.revision);
		expect(config.meta).toEqual({
			...project.config.meta,
			title: "Updated project",
		});
		expect(config.items).toEqual(project.config.items);
		expect(config.resources).toEqual({
			hero: "hero",
			"avatar-01": "item-water",
		});
		expect(config.start).toEqual(project.config.start);
	});

	it("edits initial Board cells in an explicitly selected zero-based space", async () => {
		state.project = boardSpaceProject;
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		state.section = <EditorProjectBoardSection />;
		await act(async () => {
			root.render(createElement(EditorProjectForm));
		});

		const spaceInput = container.querySelector<HTMLInputElement>(
			'input[type="number"][min="0"]',
		);
		const switchButton = Array.from(container.querySelectorAll("button")).find(
			(button) => button.textContent === "Switch",
		);
		const readGridCells = () =>
			container.querySelector<HTMLElement>('[data-ui="EditorProjectStartGrid"]')?.dataset
				.cells;
		if (spaceInput === null || switchButton === undefined)
			throw new Error("Missing initial Board space selector.");

		expect(spaceInput.value).toBe("0");
		expect(readGridCells()).toBe("water:1:0:0");
		await changeInput(spaceInput, "-1");
		expect(switchButton.disabled).toBe(true);
		await changeInput(spaceInput, "1");
		expect(readGridCells()).toBe("water:1:0:0");
		await act(async () => switchButton.click());
		expect(readGridCells()).toBe("water:2:1:1");

		const gridButton = container.querySelector<HTMLButtonElement>(
			'[data-ui="EditorProjectStartGrid"]',
		);
		if (gridButton === null) throw new Error("Missing test grid action.");
		await act(async () => gridButton.click());
		expect(readGridCells()).toBe("water:3:1:1");
		await changeInput(spaceInput, "0");
		await act(async () => switchButton.click());
		expect(readGridCells()).toBe("water:1:0:0");
		await changeInput(spaceInput, "1");
		await act(async () => switchButton.click());
		expect(readGridCells()).toBe("water:3:1:1");

		state.section = <EditorProjectGeneralSection />;
		await act(async () => root.render(createElement(EditorProjectForm)));
		state.section = <EditorProjectBoardSection />;
		await act(async () => root.render(createElement(EditorProjectForm)));
		expect(
			container.querySelector<HTMLInputElement>('input[type="number"][min="0"]')?.value,
		).toBe("0");
		expect(readGridCells()).toBe("water:1:0:0");
	});
});

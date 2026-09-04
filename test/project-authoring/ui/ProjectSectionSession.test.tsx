import { Effect } from "effect";
// @vitest-environment jsdom

import { act, createElement, memo, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

type MockButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	readonly cursorIntent?: string;
};

vi.mock("@effect/atom-react", () => ({
	scheduleTask: vi.fn(),
	useAtomSet: () => state.saveConfig,
	useAtomValue: () => undefined,
}));

vi.mock("~/authoring-session/ui/useEditorUnsavedChangesRegistration", () => ({
	useEditorUnsavedChangesRegistration: (session: typeof state.unsavedSession) => {
		state.unsavedSession = session;
	},
}));

vi.mock("~/authoring-shell/ui/EditorHistoryBackButton", () => ({
	EditorHistoryBackButton: () => createElement("span"),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const original = await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...original,
		Outlet: () => state.section,
		useNavigate: () => state.navigate,
		useParams: () => ({
			sectionId: state.sectionId,
		}),
	};
});

vi.mock("~/ui/ui/Button", () => ({
	Button: ({
		children,
		cursorIntent: _cursorIntent,
		type = "button",
		...props
	}: MockButtonProps) =>
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
		cursorIntent: _cursorIntent,
		type = "button",
		...props
	}: MockButtonProps) =>
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
	navigate: vi.fn().mockResolvedValue(undefined),
	project: undefined as unknown,
	saveConfig: vi.fn().mockResolvedValue(undefined),
	section: undefined as ReactNode,
	sectionId: "general",
	unsavedSession: undefined as
		| {
				readonly saveFn: () => Promise<boolean>;
				readonly discardFn: () => void;
		  }
		| undefined,
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

vi.mock("~/ui/fx/readSettledAsyncResultErrorFx", () => ({
	readSettledAsyncResultErrorFx: () => Effect.succeed(undefined),
}));

vi.mock("~/authoring-form/ui/AssetAutocompleteField", () => ({
	AssetAutocompleteField: ({ label }: { readonly label: string }) =>
		createElement("span", null, label),
}));

vi.mock("~/authoring-form/ui/EditorItemAutocompleteField", () => ({
	EditorItemAutocompleteField: ({ label }: { readonly label: string }) =>
		createElement("span", null, label),
}));

vi.mock("~/project-authoring/ui/ProjectStartGrid", () => ({
	ProjectStartGrid: ({
		cells,
		invalidCells = [],
		onCellsChangeFn,
		width,
	}: {
		readonly cells: ReadonlyArray<TestStartGridCell>;
		readonly invalidCells?: ReadonlyArray<{
			readonly x: number;
			readonly y: number;
		}>;
		readonly onCellsChangeFn: (cells: ReadonlyArray<TestStartGridCell>) => void;
		readonly width: number;
	}) =>
		createElement(
			"button",
			{
				"data-cells": cells
					.map(({ itemId, quantity, x, y }) => `${itemId}:${quantity}:${x}:${y}`)
					.join("|"),
				"data-invalid-cells": invalidCells.map(({ x, y }) => `${x}:${y}`).join("|"),
				"data-ui": "EditorProjectStartGrid",
				"data-width": width,
				onClick: () =>
					onCellsChangeFn(
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

import type { Project } from "~/project-authoring/type/Project";
import { Route as EditorProjectFormRouteDefinition } from "~/@routes/editor/$projectId/project/form";
import { ProjectBoardSection } from "~/project-authoring/ui/ProjectBoardSection";
import { ProjectGeneralSection } from "~/project-authoring/ui/ProjectGeneralSection";
import { ProjectToolbarSection } from "~/project-authoring/ui/ProjectToolbarSection";
import { useProjectFormSession } from "~/project-authoring/ui/ProjectFormContext";
import { editorTestPayload } from "~test/project-authoring/support/editorTestPayload";
import { boardSpaceProject } from "~test/project-authoring/support/BoardSpaceProject";
import { TranslationTestProvider } from "~test/support/TranslationTestProvider";

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
	state.navigate.mockClear();
	state.saveConfig.mockReset().mockResolvedValue(undefined);
	state.sectionId = "general";
	state.unsavedSession = undefined;
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
	it("exposes routed page help only for a section that owns guidance", async () => {
		state.project = boardSpaceProject;
		state.section = <div />;
		state.sectionId = "toolbar";
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () =>
			root.render(
				<TranslationTestProvider>
					{createElement(EditorProjectForm)}
				</TranslationTestProvider>,
			),
		);

		const open = container.querySelector<HTMLButtonElement>('[data-ui="EditorPageHelpOpen"]');
		expect(open).not.toBeNull();
		await act(async () => open?.click());
		expect(document.querySelector('[data-ui="EditorPageHelpDialog"]')).not.toBeNull();
	});

	it("does not republish the form Context when parent inputs are unchanged", async () => {
		state.project = {
			projectId: "project",
			title: editorTestPayload.config.meta.title,
			version: editorTestPayload.version,
			createdAtMs: 1,
			updatedAtMs: 2,
			revision: 0,
			config: editorTestPayload.config,
			resources: editorTestPayload.resources,
		} satisfies Project;
		let consumerRenders = 0;
		const Probe = memo(() => {
			useProjectFormSession();
			consumerRenders += 1;
			return null;
		});
		state.section = <Probe />;
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => root.render(createElement(EditorProjectForm)));
		await act(async () => root.render(createElement(EditorProjectForm)));

		expect(consumerRenders).toBe(1);
	});

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
		} satisfies Project;
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

		await renderSection(<ProjectGeneralSection />);
		const navigation = container.querySelector('[data-ui="EditorSectionNavigation"]');
		expect(container.querySelector('[data-ui="EditorCompatibilityNotice"]')).toBeNull();
		const title = container.querySelector<HTMLInputElement>('input[name="title"]');
		if (title === null) throw new Error("Missing project title input.");
		await changeInput(title, "Changed project");
		expect(container.querySelector('[data-ui="EditorCompatibilityNotice"]')).toBeNull();
		await renderSection(<div data-ui="BoardSection">Board</div>);
		await renderSection(<ProjectGeneralSection />);

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
		} satisfies Project;
		state.project = project;
		state.section = <ProjectGeneralSection />;
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
		expect(state.navigate).toHaveBeenCalledWith({
			to: "/editor/$projectId/project/detail/$sectionId",
			params: {
				projectId: project.projectId,
				sectionId: "general",
			},
			replace: true,
		});
	});

	it("opens the exact invalid avatar in Artwork after cross-section validation", async () => {
		const project = {
			...boardSpaceProject,
			config: {
				...boardSpaceProject.config,
				resources: {
					hero: "hero",
					"avatar-01": "item-water",
					"avatar-02": "item-water",
				},
			},
		} satisfies Project;
		state.project = project;
		state.section = <ProjectGeneralSection />;
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(EditorProjectForm)));

		const title = container.querySelector<HTMLInputElement>('input[name="title"]');
		if (title === null) throw new Error("Missing project title input.");
		await changeInput(title, "Project with duplicate avatar");
		const saveButton = [
			...container.querySelectorAll("button"),
		].find((button) => button.textContent?.trim() === "Save");
		if (saveButton === undefined) throw new Error("Missing project Save action.");
		await act(async () => {
			saveButton.click();
			await Promise.resolve();
		});

		expect(state.saveConfig).not.toHaveBeenCalled();
		expect(state.navigate).toHaveBeenCalledWith({
			to: "/editor/$projectId/project/form/$sectionId",
			params: {
				projectId: project.projectId,
				sectionId: "artwork",
			},
			search: {
				avatar: 1,
			},
		});
	});

	it("keeps unsaved-leave Save persistence-only", async () => {
		state.project = boardSpaceProject;
		state.section = <ProjectGeneralSection />;
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(EditorProjectForm)));

		const title = container.querySelector<HTMLInputElement>('input[name="title"]');
		if (title === null || state.unsavedSession === undefined)
			throw new Error("Missing project form session.");
		await changeInput(title, "Saved without navigation");
		await act(async () => {
			await state.unsavedSession?.saveFn();
		});

		expect(state.saveConfig).toHaveBeenCalledOnce();
		expect(state.navigate).not.toHaveBeenCalled();
	});

	it("discards the local project draft and returns to detail without saving", async () => {
		state.project = boardSpaceProject;
		state.section = <ProjectGeneralSection />;
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(EditorProjectForm)));

		const title = container.querySelector<HTMLInputElement>('input[name="title"]');
		if (title === null) throw new Error("Missing project title input.");
		await changeInput(title, "Discarded project title");
		const discardButton = [
			...container.querySelectorAll("button"),
		].find((button) => button.textContent === "Discard");
		if (discardButton === undefined) throw new Error("Missing project Discard action.");
		await act(async () => {
			discardButton.click();
			await Promise.resolve();
		});

		expect(title.value).toBe(boardSpaceProject.config.meta.title);
		expect(state.saveConfig).not.toHaveBeenCalled();
		expect(state.navigate).toHaveBeenCalledWith({
			to: "/editor/$projectId/project/detail/$sectionId",
			params: {
				projectId: boardSpaceProject.projectId,
				sectionId: "general",
			},
			replace: true,
		});
	});

	it("edits initial Board cells in the zero-based space selected live", async () => {
		state.project = boardSpaceProject;
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		state.section = <ProjectBoardSection />;
		await act(async () => {
			root.render(createElement(EditorProjectForm));
		});

		const spaceInput = container.querySelector<HTMLInputElement>(
			'input[type="number"][min="0"]',
		);
		const readGridCells = () =>
			container.querySelector<HTMLElement>('[data-ui="EditorProjectStartGrid"]')?.dataset
				.cells;
		if (spaceInput === null) throw new Error("Missing initial Board space selector.");

		expect(spaceInput.value).toBe("0");
		expect(readGridCells()).toBe("water:1:0:0");
		await changeInput(spaceInput, "-1");
		expect(readGridCells()).toBe("water:1:0:0");
		await changeInput(spaceInput, "1");
		expect(readGridCells()).toBe("water:2:1:1");
		expect(spaceInput.max).toBe("31");
		await changeInput(spaceInput, "32");
		expect(readGridCells()).toBe("water:2:1:1");
		await changeInput(spaceInput, "31");
		expect(readGridCells()).toBe("");
		await changeInput(spaceInput, "1");
		expect(readGridCells()).toBe("water:2:1:1");

		const gridButton = container.querySelector<HTMLButtonElement>(
			'[data-ui="EditorProjectStartGrid"]',
		);
		if (gridButton === null) throw new Error("Missing test grid action.");
		await act(async () => gridButton.click());
		expect(readGridCells()).toBe("water:3:1:1");
		await changeInput(spaceInput, "0");
		expect(readGridCells()).toBe("water:1:0:0");
		await changeInput(spaceInput, "1");
		expect(readGridCells()).toBe("water:3:1:1");

		state.section = <ProjectGeneralSection />;
		await act(async () => root.render(createElement(EditorProjectForm)));
		state.section = <ProjectBoardSection />;
		await act(async () => root.render(createElement(EditorProjectForm)));
		expect(
			container.querySelector<HTMLInputElement>('input[type="number"][min="0"]')?.value,
		).toBe("0");
		expect(readGridCells()).toBe("water:1:0:0");
	});

	it("routes a start-item validation issue to its exact Board space and cell", async () => {
		state.project = {
			...boardSpaceProject,
			config: {
				...boardSpaceProject.config,
				start: {
					...boardSpaceProject.config.start,
					board: [
						boardSpaceProject.config.start.board[0],
						{
							...boardSpaceProject.config.start.board[1],
							space: 0,
							x: 0,
							y: 0,
						},
					],
				},
			},
		} satisfies Project;
		state.section = <ProjectBoardSection />;
		state.sectionId = "board";
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () =>
			root.render(
				<TranslationTestProvider>
					{createElement(EditorProjectForm)}
				</TranslationTestProvider>,
			),
		);

		const widthInput = container.querySelector<HTMLInputElement>('input[name="board.width"]');
		const saveButton = [
			...container.querySelectorAll("button"),
		].find((button) => button.textContent === "Save");
		if (widthInput === null || saveButton === undefined)
			throw new Error("Missing Board validation controls.");
		await changeInput(widthInput, "14");
		await act(async () => {
			saveButton.click();
			await Promise.resolve();
		});

		const grid = container.querySelector<HTMLElement>('[data-ui="EditorProjectStartGrid"]');
		expect(container.textContent).toContain("Initial board → space 0 → slot 1, 1:");
		expect(
			container.querySelector<HTMLInputElement>('input[type="number"][min="0"]')?.value,
		).toBe("0");
		expect(grid?.dataset.cells).toBe("water:1:0:0|water:2:0:0");
		expect(grid?.dataset.invalidCells).toBe("0:0");
	});

	it("caps a pasted Board dimension before projecting it to the grid", async () => {
		state.project = boardSpaceProject;
		state.section = <ProjectBoardSection />;
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => root.render(createElement(EditorProjectForm)));

		const widthInput = container.querySelector<HTMLInputElement>('input[name="board.width"]');
		const grid = container.querySelector<HTMLElement>('[data-ui="EditorProjectStartGrid"]');
		if (widthInput === null || grid === null) throw new Error("Missing Board size controls.");

		await changeInput(widthInput, "1500");

		expect(widthInput.value).toBe("42");
		expect(grid.dataset.width).toBe("42");
	});

	it("submits an edited initial Toolbar cell without leaking grid coordinates", async () => {
		const project = {
			...boardSpaceProject,
			config: {
				...boardSpaceProject.config,
				meta: {
					...boardSpaceProject.config.meta,
					toolbarSize: 1,
				},
				start: {
					...boardSpaceProject.config.start,
					toolbar: [
						{
							itemId: "water",
							position: {
								x: 0,
								y: 0,
							},
							quantity: 1,
						},
					],
				},
			},
		} satisfies Project;
		state.project = project;
		state.section = <ProjectToolbarSection />;
		state.sectionId = "toolbar";
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () =>
			root.render(
				<TranslationTestProvider>
					{createElement(EditorProjectForm)}
				</TranslationTestProvider>,
			),
		);

		const gridButton = container.querySelector<HTMLButtonElement>(
			'[data-ui="EditorProjectStartGrid"]',
		);
		const form = container.querySelector("form");
		if (gridButton === null || form === null) throw new Error("Missing Toolbar form controls.");
		await act(async () => gridButton.click());
		await act(async () => {
			form.dispatchEvent(
				new SubmitEvent("submit", {
					bubbles: true,
					cancelable: true,
				}),
			);
			await Promise.resolve();
		});

		expect(state.saveConfig).toHaveBeenCalledOnce();
		const [{ config }] = state.saveConfig.mock.calls[0] ?? [];
		expect(config.start.toolbar).toEqual([
			{
				itemId: "water",
				position: {
					x: 0,
					y: 0,
				},
				quantity: 2,
			},
		]);
	});

	it.each([
		"edited",
		"blurred",
	] as const)(
		"pins %s project values through MCP refresh until discard or successful save",
		async (interaction) => {
			let project: Project = {
				...boardSpaceProject,
				revision: 1,
			};
			state.project = project;
			state.section = <ProjectGeneralSection />;
			const container = document.createElement("div");
			document.body.append(container);
			const root = createRoot(container);
			roots.push(root);
			const renderProject = async () => {
				await act(async () => root.render(createElement(EditorProjectForm)));
			};
			const publishConfig = async (config: Project["config"]) => {
				project = {
					...project,
					revision: project.revision + 1,
					config,
				};
				state.project = project;
				await renderProject();
			};
			await renderProject();
			await publishConfig({
				...project.config,
				meta: {
					...project.config.meta,
					title: "First MCP title",
					board: {
						width: 30,
						height: 30,
					},
				},
			});
			const title = container.querySelector<HTMLInputElement>('input[name="title"]');
			if (title === null) throw new Error("Missing project title input.");
			expect(title.value).toBe("First MCP title");
			if (interaction === "edited") await changeInput(title, "Local project title");
			else
				await act(async () => {
					title.focus();
					title.blur();
				});
			await publishConfig({
				...project.config,
				meta: {
					...project.config.meta,
					board: {
						width: 31,
						height: 31,
					},
				},
			});
			if (interaction === "blurred") {
				expect(title.value).toBe("First MCP title");
				await changeInput(title, "Local project title");
			}
			state.saveConfig.mockImplementation(async ({ config, expectedRevision }) => {
				if (expectedRevision !== project.revision) throw new Error("Stale draft");
				await publishConfig(config);
			});
			await act(async () => {
				await expect(state.unsavedSession?.saveFn()).rejects.toThrow("Stale draft");
			});
			expect(state.saveConfig).toHaveBeenLastCalledWith(
				expect.objectContaining({
					expectedRevision: 2,
					config: expect.objectContaining({
						meta: expect.objectContaining({
							board: {
								width: 30,
								height: 30,
							},
						}),
					}),
				}),
			);
			expect(title.value).toBe("Local project title");
			await act(async () => state.unsavedSession?.discardFn());
			await changeInput(title, "Saved project title");
			await act(async () => {
				await state.unsavedSession?.saveFn();
			});
			expect(state.saveConfig).toHaveBeenLastCalledWith(
				expect.objectContaining({
					expectedRevision: 3,
					config: expect.objectContaining({
						meta: expect.objectContaining({
							board: {
								width: 31,
								height: 31,
							},
						}),
					}),
				}),
			);
			await changeInput(title, "Saved again");
			await act(async () => {
				await state.unsavedSession?.saveFn();
			});
			expect(state.saveConfig).toHaveBeenLastCalledWith(
				expect.objectContaining({
					expectedRevision: 4,
				}),
			);
		},
	);
});

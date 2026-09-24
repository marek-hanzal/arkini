import { createProducerItem } from "~test/game-config-validation/support/gameValidationTestSource";
import { OutcomeTableSchema } from "~/outcome/schema/OutcomeTableSchema";
// @vitest-environment jsdom
import { Effect } from "effect";
import { createEditorUnsavedChangesOwnerFx } from "~/authoring-session/fx/createEditorUnsavedChangesOwnerFx";
import type {
	EditorUnsavedChangesService,
	EditorUnsavedChangesSession,
} from "~/authoring-session/service/EditorUnsavedChanges";
import { TemplateForm } from "~/template-authoring/ui/TemplateForm";
import { act, createElement, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { editorTestConfig } from "~test/project-authoring/support/editorTestPayload";
import type { TemplateSchema } from "~/board-template/schema/TemplateSchema";
import { useTemplateFormController } from "~/template-authoring/ui/useTemplateFormController";
import { TemplateDetail } from "~/template-authoring/ui/TemplateDetail";

const state = vi.hoisted(() => ({
	project: undefined as unknown,
	owner: undefined as unknown as EditorUnsavedChangesService,
	page: undefined as unknown as {
		discardFn: () => Promise<void>;
		saveFn: () => Promise<boolean>;
	},
	changeWidth: undefined as unknown as (value: number) => void,
	save: vi.fn(),
	unsaved: undefined as EditorUnsavedChangesSession | undefined,
	navigate: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("~/ui/ui/LinkButton", () => ({
	LinkButton: (props: ButtonHTMLAttributes<HTMLButtonElement>) => createElement("button", props),
	LinkButtonLink: ({ children }: { children: ReactNode }) =>
		createElement("span", null, children),
}));
vi.mock("~/template-authoring/ui/TemplateSectionBar", () => ({
	TemplateSectionBar: ({ actions }: { actions?: ReactNode }) => actions,
}));

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));
vi.mock("~/authoring-session/ui/useEditorUnsavedChangesRegistration", () => ({
	useEditorUnsavedChangesOwner: () => state.owner,
	useEditorUnsavedChangesRegistration: (session: typeof state.unsaved) => {
		state.unsaved = session;
		if (session) state.owner.registerFn("template", session);
	},
}));
vi.mock("~/project-authoring/fx/saveProjectConfigFx", () => ({
	saveProjectConfigFx: (input: unknown) => input,
}));
vi.mock("~/application-runtime/service/RendererRuntime", () => ({
	RendererRuntime: {
		runPromise: (input: unknown) => state.save(input),
	},
}));
vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => state.navigate,
}));
vi.mock("~/translation/ui/useTranslator", () => ({
	useTranslator: () => ({
		textFn: (text: string) => text,
	}),
}));
vi.mock("~/board-authoring/ui/BoardGrid", () => ({
	BoardGrid: () => null,
}));
vi.mock("~/authoring-shell/ui/EditorHistoryBackButton", () => ({
	EditorHistoryBackButton: () => null,
}));
vi.mock("~/ui/ui/Button", () => ({
	Button: (props: ButtonHTMLAttributes<HTMLButtonElement>) => createElement("button", props),
	ButtonLink: ({ children, ...destination }: { children: ReactNode }) =>
		createElement(
			"a",
			{
				onClick: () => state.navigate(destination),
			},
			children,
		),
	DangerButton: (props: ButtonHTMLAttributes<HTMLButtonElement>) =>
		createElement("button", props),
	PrimaryButtonLink: ({
		children,
		ref,
		...destination
	}: {
		children: ReactNode;
		ref: import("react").Ref<HTMLAnchorElement>;
	}) =>
		createElement(
			"a",
			{
				ref,
				onClick: () => state.navigate(destination),
			},
			children,
		),
}));

vi.mock("~/editor-control/ui/EditorFormSectionPage", () => ({
	EditorFormSectionPage: (
		props: typeof state.page & {
			children: ReactNode;
		},
	) => {
		state.page = props;
		return props.children;
	},
}));
vi.mock("~/editor-control/ui/EditorValueControls", () => ({
	EditorTextControl: () => null,
	EditorNumberControl: ({
		label,
		onChangeFn,
	}: {
		label: string;
		onChangeFn: (value: number) => void;
	}) => {
		if (label === "Width") state.changeWidth = onChangeFn;
		return null;
	},
}));

const template: TemplateSchema.Type = {
	uid: "template",
	title: "Template",
	width: 3,
	height: 2,
	board: [
		{
			itemUid: "water",
			x: 0,
			y: 0,
		},
	],
};
const projectFn = (
	revision: number,
	templates = [
		template,
	],
) => ({
	projectId: "project",
	revision,
	config: {
		...editorTestConfig,
		templates,
	},
});
let root: Root;
let container: HTMLDivElement;
let controller: ReturnType<typeof useTemplateFormController>;
const savedFn = vi.fn();
const Form = ({ value }: { value: TemplateSchema.Type }) => {
	controller = useTemplateFormController({
		template: value,
		onSavedFn: savedFn,
	});
	return null;
};

beforeEach(() => {
	(
		globalThis as {
			IS_REACT_ACT_ENVIRONMENT?: boolean;
		}
	).IS_REACT_ACT_ENVIRONMENT = true;
	state.project = projectFn(1);
	state.owner = Effect.runSync(createEditorUnsavedChangesOwnerFx());
	state.save.mockReset().mockResolvedValue(undefined);
	state.navigate.mockClear();
	savedFn.mockReset();
	state.unsaved = undefined;
	container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
});
afterEach(async () => {
	await act(async () => root.unmount());
	container.remove();
});

const beginDeleteFn = async () => {
	await act(async () =>
		root.render(
			<TemplateDetail
				templateUid="template"
				section="delete"
			/>,
		),
	);
	await act(async () => {
		const buttons = [
			...container.querySelectorAll("button"),
		];
		buttons.at(-1)!.click();
	});
};

describe("template draft and deletion settlement", () => {
	it("duplicates a template under a fresh UID without changing the original or its board", async () => {
		await act(async () =>
			root.render(
				<TemplateDetail
					templateUid="template"
					section="general"
				/>,
			),
		);
		const duplicate = container.querySelector<HTMLButtonElement>(
			'[data-ui="TemplateDuplicate"]',
		);
		await act(async () => duplicate!.click());
		const saved = state.save.mock.lastCall?.[0] as {
			expectedRevision: number;
			config: {
				templates: TemplateSchema.Type[];
			};
		};
		expect(saved.expectedRevision).toBe(1);
		expect(saved.config.templates[0]).toEqual(template);
		const copy = saved.config.templates[1]!;
		expect(copy.uid).not.toBe(template.uid);
		expect(copy.title).toBe("Template (copy)");
		expect(copy.board).toEqual(template.board);
		expect(copy.board).not.toBe(template.board);
		expect(state.navigate).toHaveBeenCalledWith({
			to: "/editor/$projectId/templates/$templateUid/form/$sectionId",
			params: {
				projectId: "project",
				templateUid: copy.uid,
				sectionId: "general",
			},
		});
	});

	it("routes the actual E shortcut to the currently displayed board form", async () => {
		await act(async () =>
			root.render(
				<TemplateDetail
					templateUid="template"
					section="board"
				/>,
			),
		);
		await act(async () => {
			window.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "e",
				}),
			);
		});
		expect(state.navigate).toHaveBeenCalledWith(
			expect.objectContaining({
				to: "/editor/$projectId/templates/$templateUid/form/$sectionId",
				params: {
					projectId: "project",
					templateUid: "template",
					sectionId: "board",
				},
			}),
		);
	});

	it("exits a clean board form directly and retains its section", async () => {
		await act(async () =>
			root.render(
				<TemplateForm
					template={template}
					section="board"
				/>,
			),
		);
		await act(async () => state.page.discardFn());
		expect(state.owner.getSnapshotFn().promptOpen).toBe(false);
		expect(state.navigate).toHaveBeenCalledWith(
			expect.objectContaining({
				params: {
					projectId: "project",
					templateUid: "template",
					sectionId: "board",
				},
				to: "/editor/$projectId/templates/$templateUid/detail/$sectionId",
			}),
		);
	});

	it("keeps dimension changes across tabs and asks the shared owner before discarding", async () => {
		await act(async () =>
			root.render(
				<TemplateForm
					template={template}
					section="general"
				/>,
			),
		);
		await act(async () => state.changeWidth(4));
		expect(state.unsaved?.isDirtyFn()).toBe(true);
		expect(
			await state.owner.requestLeaveFn("/editor/project/templates/template/form/board"),
		).toBe(true);
		await act(async () =>
			root.render(
				<TemplateForm
					template={template}
					section="board"
				/>,
			),
		);
		expect(state.unsaved?.isDirtyFn()).toBe(true);
		let leaving: Promise<void>;
		await act(async () => {
			leaving = state.page.discardFn();
		});
		expect(state.owner.getSnapshotFn().promptOpen).toBe(true);
		await act(async () => {
			await state.owner.decideFn("cancel");
			await leaving;
		});
		expect(state.navigate).not.toHaveBeenCalled();
		expect(state.unsaved?.isDirtyFn()).toBe(true);
		await act(async () => {
			leaving = state.page.discardFn();
		});
		await act(async () => {
			await state.owner.decideFn("discard");
			await leaving;
		});
		expect(state.unsaved?.isDirtyFn()).toBe(false);
		expect(state.navigate).toHaveBeenCalledWith(
			expect.objectContaining({
				params: {
					projectId: "project",
					templateUid: "template",
					sectionId: "board",
				},
			}),
		);
	});

	it("settles a saved normalized title as the clean draft", async () => {
		await act(async () => root.render(<Form value={template} />));
		await act(async () =>
			controller.setValueFn({
				...controller.value,
				title: " Forest ",
			}),
		);
		expect(controller.dirty).toBe(true);
		expect(state.unsaved?.isDirtyFn()).toBe(true);
		savedFn.mockImplementation(() => {
			expect(state.unsaved?.isDirtyFn()).toBe(false);
		});
		state.save.mockImplementation(async (input) => {
			state.project = projectFn(2, input.config.templates);
			root.render(<Form value={input.config.templates[0]} />);
		});
		await act(async () => controller.saveFn());
		expect(state.save).toHaveBeenCalledWith(
			expect.objectContaining({
				config: expect.objectContaining({
					templates: [
						{
							...template,
							title: "Forest",
						},
					],
				}),
			}),
		);
		expect(savedFn).toHaveBeenCalledWith(template.uid);
		expect(controller.value.title).toBe("Forest");
		expect(controller.dirty).toBe(false);
	});

	it("rebases a pristine draft before a title edit so save preserves the newer board", async () => {
		await act(async () => root.render(<Form value={template} />));
		const changed = {
			...template,
			board: [
				{
					itemUid: "water",
					x: 2,
					y: 1,
				},
			],
		};
		state.project = projectFn(2, [
			changed,
		]);
		await act(async () => root.render(<Form value={changed} />));
		await act(async () =>
			controller.setValueFn({
				...controller.value,
				title: "Renamed",
			}),
		);
		await act(async () => controller.saveFn());
		expect(state.save).toHaveBeenCalledWith(
			expect.objectContaining({
				expectedRevision: 2,
				config: expect.objectContaining({
					templates: [
						{
							...changed,
							title: "Renamed",
						},
					],
				}),
			}),
		);
	});

	it("pins a dirty draft to its original revision when canonical data changes", async () => {
		await act(async () => root.render(<Form value={template} />));
		await act(async () =>
			controller.setValueFn({
				...controller.value,
				title: "Local title",
			}),
		);
		const changed = {
			...template,
			board: [
				{
					itemUid: "water",
					x: 2,
					y: 1,
				},
			],
		};
		state.project = projectFn(2, [
			changed,
		]);
		await act(async () => root.render(<Form value={changed} />));
		await act(async () => controller.saveFn());
		expect(state.save).toHaveBeenCalledWith(
			expect.objectContaining({
				expectedRevision: 1,
				config: expect.objectContaining({
					templates: [
						{
							...template,
							title: "Local title",
						},
					],
				}),
			}),
		);
	});

	it("navigates after deletion settles even when canonical publication removes the template first", async () => {
		let resolveFn!: () => void;
		state.save.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					resolveFn = resolve;
				}),
		);
		await beginDeleteFn();
		expect(state.save).toHaveBeenCalledWith(
			expect.objectContaining({
				expectedRevision: 1,
				config: expect.objectContaining({
					templates: [],
				}),
			}),
		);
		state.project = projectFn(2, []);
		await act(async () =>
			root.render(
				<TemplateDetail
					templateUid="template"
					section="delete"
				/>,
			),
		);
		expect(state.navigate).not.toHaveBeenCalled();
		await act(async () => resolveFn());
		expect(state.navigate).toHaveBeenCalledWith({
			to: "/editor/$projectId/templates",
			params: {
				projectId: "project",
			},
		});
	});

	it("suppresses deletion navigation after its detail unmounts", async () => {
		let resolveFn!: () => void;
		state.save.mockImplementation(
			() =>
				new Promise<void>((resolve) => {
					resolveFn = resolve;
				}),
		);
		await beginDeleteFn();
		await act(async () => root.render(null));
		await act(async () => resolveFn());
		expect(state.navigate).not.toHaveBeenCalled();
	});
});

it("blocks template deletion while an authored outcome references its UID", async () => {
	const project = projectFn(1);
	state.project = {
		...project,
		config: {
			...project.config,
			items: {
				...project.config.items,
				portal: createProducerItem({
					id: "portal",
					outcome: OutcomeTableSchema.parse({
						set: [
							{
								rules: [],
								roll: [
									{
										type: "guaranteed",
										outcome: [
											{
												type: "template",
												templateUid: "template",
												rules: [],
											},
										],
									},
								],
							},
						],
					}),
				}),
			},
		},
	};
	await act(async () =>
		root.render(
			<TemplateDetail
				templateUid="template"
				section="delete"
			/>,
		),
	);
	expect(state.save).not.toHaveBeenCalled();
	const blockerLink = container.querySelector<HTMLAnchorElement>(
		"[data-ui='TemplateDeleteBlockers'] a",
	);
	expect(blockerLink).not.toBeNull();
	expect(container.querySelector("button")).toBeNull();
	await act(async () => blockerLink!.click());
	expect(state.navigate).toHaveBeenCalledWith(
		expect.objectContaining({
			to: "/editor/$projectId/editor/items/$itemUid/form/$sectionId",
			params: {
				projectId: "project",
				itemUid: "portal",
				sectionId: "production",
			},
			search: {
				lineUid: expect.any(String),
				merge: undefined,
				outcomeSet: 0,
				outcomeRoll: 0,
				outcomeIndex: 0,
			},
		}),
	);
});

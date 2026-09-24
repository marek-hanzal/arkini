// @vitest-environment jsdom
import { act, createElement, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { editorTestConfig } from "~test/project-authoring/support/editorTestPayload";
import type { TemplateSchema } from "~/board-template/schema/TemplateSchema";
import { Templates } from "~/template-authoring/ui/Templates";

const state = vi.hoisted(() => ({
	project: undefined as unknown,
	save: vi.fn().mockResolvedValue(undefined),
	navigate: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));
vi.mock("@tanstack/react-router", () => ({
	useNavigate: () => state.navigate,
}));
vi.mock("~/application-runtime/service/RendererRuntime", () => ({
	RendererRuntime: {
		runPromise: (input: unknown) => state.save(input),
	},
}));
vi.mock("~/project-authoring/fx/saveProjectConfigFx", () => ({
	saveProjectConfigFx: (input: unknown) => input,
}));
vi.mock("~/translation/ui/useTranslator", () => ({
	useTranslator: () => ({
		textFn: (text: string) => text,
	}),
}));
vi.mock("~/authoring-shell/ui/EditorHistoryBackButton", () => ({
	EditorHistoryBackButton: () => null,
}));
vi.mock("~/authoring-shell/ui/EditorPageHelp", () => ({
	EditorPageHelp: () => null,
}));
vi.mock("~/authoring-shell/ui/EditorSectionPage", () => ({
	EditorSectionPage: ({
		header,
		secondaryNavigation,
		children,
	}: {
		header: ReactNode;
		secondaryNavigation: ReactNode;
		children: ReactNode;
	}) => createElement("main", null, header, secondaryNavigation, children),
}));
vi.mock("~/authoring-shell/ui/EditorSectionBar", () => ({
	EditorSectionBar: ({ children }: { children: ReactNode }) => children,
	EditorSectionShortcutNavigation: ({
		options,
		onChangeFn,
	}: {
		options: Array<{
			label: string;
			value: string;
		}>;
		onChangeFn: (value: string) => void;
	}) =>
		options.map((option) =>
			createElement(
				"button",
				{
					key: option.value,
					onClick: () => onChangeFn(option.value),
				},
				option.label,
			),
		),
}));
vi.mock("~/ui/ui/Button", () => ({
	ButtonLink: ({ children, to, params }: { children: ReactNode; to: string; params: unknown }) =>
		createElement(
			"a",
			{
				onClick: () =>
					state.navigate({
						to,
						params,
					}),
			},
			children,
		),
	PrimaryButtonLink: ({ children }: { children: ReactNode }) =>
		createElement("a", null, children),
}));
vi.mock("~/ui/ui/LinkButton", () => ({
	LinkButton: (props: ButtonHTMLAttributes<HTMLButtonElement>) => createElement("button", props),
}));
vi.mock("~/ui/ui/SearchInput", () => ({
	SearchInput: () => null,
}));
vi.mock("~/ui/ui/Status", () => ({
	Status: ({ title }: { title: string }) => createElement("p", null, title),
}));

const templateFn = (uid: string, title: string): TemplateSchema.Type => ({
	uid,
	title,
	width: 5,
	height: 4,
	board: [],
});

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
	(
		globalThis as {
			IS_REACT_ACT_ENVIRONMENT?: boolean;
		}
	).IS_REACT_ACT_ENVIRONMENT = true;
	state.project = {
		projectId: "project",
		revision: 3,
		config: {
			...editorTestConfig,
			templates: [
				...editorTestConfig.templates!,
				templateFn("zeta", "Zeta"),
				templateFn("alpha", "Alpha"),
			],
		},
	};
	state.save.mockClear();
	state.navigate.mockClear();
	container = document.createElement("div");
	document.body.append(container);
	root = createRoot(container);
});

afterEach(async () => {
	await act(async () => root.unmount());
	container.remove();
});

it("sorts templates by title, filters actual references, and copies without opening the source", async () => {
	await act(async () => root.render(<Templates />));
	expect(
		[
			...container.querySelectorAll('[data-ui="TemplateList"] li a'),
		].map((entry) => entry.textContent?.trim()),
	).toEqual([
		"Alpha",
		"Initial",
		"Zeta",
	]);

	await act(async () => {
		[
			...container.querySelectorAll("button"),
		]
			.find((button) => button.textContent === "Unused")!
			.click();
	});
	expect(
		[
			...container.querySelectorAll('[data-ui="TemplateList"] li a'),
		].map((entry) => entry.textContent?.trim()),
	).toEqual([
		"Alpha",
		"Zeta",
	]);

	await act(async () => {
		container.querySelector<HTMLButtonElement>('[data-ui="TemplateListCopy"]')!.click();
	});
	const saved = state.save.mock.lastCall?.[0] as {
		expectedRevision: number;
		config: {
			templates: TemplateSchema.Type[];
		};
	};
	expect(saved.expectedRevision).toBe(3);
	expect(saved.config.templates.at(-1)).toEqual(
		expect.objectContaining({
			title: "Alpha (copy)",
		}),
	);
	expect(saved.config.templates.at(-1)?.uid).not.toBe("alpha");
	expect(state.navigate).toHaveBeenCalledExactlyOnceWith({
		to: "/editor/$projectId/templates/$templateUid/form/$sectionId",
		params: {
			projectId: "project",
			templateUid: saved.config.templates.at(-1)?.uid,
			sectionId: "general",
		},
	});
});

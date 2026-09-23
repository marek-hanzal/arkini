// @vitest-environment jsdom

import { TranslationTestProvider } from "~test/support/TranslationTestProvider";

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/ui/ui/LinkButton", () => ({
	LinkButtonLink: ({ children }: { children: import("react").ReactNode }) =>
		createElement("span", null, children),
}));

vi.mock("~/board-authoring/ui/BoardGrid", () => ({
	BoardGrid: ({
		cells,
	}: {
		readonly cells: ReadonlyArray<{
			readonly itemUid: string;
		}>;
	}) =>
		createElement("div", {
			"data-items": cells.map((cell) => cell.itemUid).join(","),
			"data-ui": "EditorBoardGrid",
		}),
}));

vi.mock("~/editor-control/ui/EditorSearchCombobox", () => ({
	EditorSearchCombobox: ({
		onChangeFn,
		options,
		value,
	}: {
		readonly onChangeFn: (value: string) => void;
		readonly options: ReadonlyArray<{
			readonly id: string;
		}>;
		readonly value: string;
	}) =>
		createElement(
			"select",
			{
				onChange: (event: { readonly currentTarget: HTMLSelectElement }) =>
					onChangeFn(event.currentTarget.value),
				value,
			},
			options.map((option) =>
				createElement(
					"option",
					{
						key: option.id,
						value: option.id,
					},
					option.id,
				),
			),
		),
}));

import type { Project } from "~/project-authoring/type/Project";
import { ProjectBoardDetail } from "~/project-authoring/ui/ProjectBoardDetail";
import { boardSpaceProject } from "~test/project-authoring/support/BoardSpaceProject";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

describe("project Board detail", () => {
	it.each([
		undefined,
		4,
	])(
		"selects the requested Space %s and renders one configured Board preview",
		async (initialSpace) => {
			const project = {
				...boardSpaceProject,
				config: {
					...boardSpaceProject.config,
					start: {
						...boardSpaceProject.config.start,
						spaces: boardSpaceProject.config.start.spaces.map((entry) => ({
							...entry,
							space: entry.space === 1 ? 4 : entry.space,
						})),
					},
				},
			} satisfies Project;
			const container = document.createElement("div");
			document.body.append(container);
			const root = createRoot(container);
			roots.push(root);
			await act(async () => {
				root.render(
					<TranslationTestProvider>
						<ProjectBoardDetail
							project={project}
							initialSpace={initialSpace}
						/>
					</TranslationTestProvider>,
				);
			});

			const select = container.querySelector("select");
			const preview = () =>
				container.querySelector<HTMLElement>('[data-ui="EditorBoardGrid"]');
			if (select === null) throw new Error("Missing Space selector.");
			expect(Array.from(select.options, (option) => option.value)).toEqual([
				"0",
				"4",
			]);
			expect(select.value).toBe(String(initialSpace ?? 0));
			expect(preview()?.dataset.items).toBe("water");

			await act(async () => {
				select.value = "4";
				select.dispatchEvent(
					new Event("change", {
						bubbles: true,
					}),
				);
			});

			expect(preview()?.dataset.items).toBe("water");
			expect(container.querySelectorAll('[data-ui="EditorBoardGrid"]')).toHaveLength(1);
		},
	);
});

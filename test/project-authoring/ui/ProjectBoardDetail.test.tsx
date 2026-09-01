// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("~/project-authoring/ui/ProjectStartGridDetail", () => ({
	ProjectStartGridDetail: ({
		cells,
	}: {
		readonly cells: ReadonlyArray<{
			readonly itemId: string;
			readonly quantity: number;
		}>;
	}) =>
		createElement("div", {
			"data-items": cells.map((cell) => `${cell.itemId}:${cell.quantity}`).join(","),
			"data-ui": "EditorProjectStartGridDetail",
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
	it("selects only configured non-linear Spaces and renders one preview", async () => {
		const project = {
			...boardSpaceProject,
			config: {
				...boardSpaceProject.config,
				start: {
					...boardSpaceProject.config.start,
					board: boardSpaceProject.config.start.board.map((entry) => ({
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
		await act(async () => root.render(<ProjectBoardDetail project={project} />));

		const select = container.querySelector("select");
		const preview = () =>
			container.querySelector<HTMLElement>('[data-ui="EditorProjectStartGridDetail"]');
		if (select === null) throw new Error("Missing Space selector.");
		expect(Array.from(select.options, (option) => option.value)).toEqual([
			"0",
			"4",
		]);
		expect(preview()?.dataset.items).toBe("water:1");

		await act(async () => {
			select.value = "4";
			select.dispatchEvent(
				new Event("change", {
					bubbles: true,
				}),
			);
		});

		expect(preview()?.dataset.items).toBe("water:2");
		expect(container.querySelectorAll('[data-ui="EditorProjectStartGridDetail"]')).toHaveLength(
			1,
		);
	});
});

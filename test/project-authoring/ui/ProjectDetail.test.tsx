// @vitest-environment jsdom

import { act, createElement, forwardRef, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	edit: vi.fn(),
}));

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		projectId: "project",
		config: {
			meta: {
				title: "Project title",
			},
		},
	}),
}));

vi.mock("~/authoring-shell/ui/EditorHistoryBackButton", () => ({
	EditorHistoryBackButton: () => createElement("span"),
}));

vi.mock("~/project-authoring/ui/ProjectSectionLink", () => ({
	ProjectSectionLink: ({
		section,
	}: {
		readonly section: {
			readonly label: string;
		};
	}) => createElement("span", null, section.label),
}));

vi.mock("~/ui/ui/Button", () => ({
	PrimaryButtonLink: forwardRef<
		HTMLAnchorElement,
		{
			readonly children?: ReactNode;
		}
	>(({ children }, ref) =>
		createElement(
			"a",
			{
				href: "#edit",
				onClick: (event: MouseEvent) => {
					event.preventDefault();
					state.edit();
				},
				ref,
			},
			children,
		),
	),
}));

import { ProjectDetail } from "~/project-authoring/ui/ProjectDetail";

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
	state.edit.mockClear();
});

describe("project detail", () => {
	it("opens the mounted Edit action with the unmodified E shortcut", async () => {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				<ProjectDetail sectionId="general">
					<div>General detail</div>
				</ProjectDetail>,
			);
		});

		window.dispatchEvent(
			new KeyboardEvent("keydown", {
				key: "e",
			}),
		);

		expect(state.edit).toHaveBeenCalledOnce();
	});
});

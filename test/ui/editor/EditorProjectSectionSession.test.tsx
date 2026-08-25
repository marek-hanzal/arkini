import { Effect } from "effect";
// @vitest-environment jsdom

import { act, createElement, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@effect/atom-react", () => ({
	scheduleTask: vi.fn(),
	useAtomSet: () => vi.fn(),
	useAtomValue: () => undefined,
}));

vi.mock("~/ui/editor/useEditorUnsavedChangesRegistration", () => ({
	useEditorUnsavedChangesRegistration: () => undefined,
}));

vi.mock("~/ui/editor/EditorHistoryBackButton", () => ({
	EditorHistoryBackButton: () => createElement("span"),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const original = await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...original,
		useNavigate: () => vi.fn().mockResolvedValue(undefined),
	};
});

vi.mock("~/ui/button/Button", () => ({
	Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) =>
		createElement("button", props, children),
	ButtonLink: ({ children }: { readonly children?: ReactNode }) =>
		createElement("a", null, children),
	PrimaryButton: ({ children }: { readonly children?: ReactNode }) =>
		createElement("button", null, children),
}));

const state = vi.hoisted(() => ({
	project: undefined as unknown,
}));

vi.mock("~/bridge/editor/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));

vi.mock("~/bridge/project/editor/saveEditorProjectConfigCommandAtom", () => ({
	saveEditorProjectConfigCommandAtom: () => ({
		id: "save-editor-project",
	}),
}));

vi.mock("~/ui/reactivity/readSettledAsyncResultErrorFx", () => ({
	readSettledAsyncResultErrorFx: () => Effect.succeed(undefined),
}));

vi.mock("~/ui/resource/editor/EditorAssetAutocompleteField", () => ({
	EditorAssetAutocompleteField: ({ label }: { readonly label: string }) =>
		createElement("span", null, label),
}));

vi.mock("~/ui/item/editor/EditorItemAutocompleteField", () => ({
	EditorItemAutocompleteField: ({ label }: { readonly label: string }) =>
		createElement("span", null, label),
}));

import type { EditorProject } from "~/bridge/editor/EditorProject";
import { EditorProjectForm } from "~/ui/project/editor/EditorProjectForm";
import { EditorProjectAppearanceSection } from "~/ui/project/editor/EditorProjectAppearanceSection";
import { EditorProjectGeneralSection } from "~/ui/project/editor/EditorProjectGeneralSection";
import { EditorProjectInventorySection } from "~/ui/project/editor/EditorProjectInventorySection";
import { editorTestPayload } from "~test/editor/support/editorTestPayload";

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
	it("opens Appearance on the avatar requested by an asset usage link", async () => {
		state.project = {
			projectId: "project",
			title: editorTestPayload.config.meta.title,
			version: editorTestPayload.version,
			createdAtMs: 1,
			updatedAtMs: 2,
			revision: 0,
			config: {
				...editorTestPayload.config,
				resources: {
					...editorTestPayload.config.resources,
					"avatar-01": "avatar-first",
					"avatar-02": "avatar-current",
				},
			},
			resources: [
				...editorTestPayload.resources,
				{
					id: "avatar-first",
					mime: "image/png",
					bytes: Uint8Array.of(7),
				},
				{
					id: "avatar-current",
					mime: "image/png",
					bytes: Uint8Array.of(8),
				},
			],
		} satisfies EditorProject;
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);

		await act(async () => {
			root.render(
				<EditorProjectForm>
					<EditorProjectAppearanceSection initialAvatarIndex={1} />
				</EditorProjectForm>,
			);
		});

		expect(
			container.querySelector<HTMLInputElement>('input[aria-label="About avatars"]')?.value,
		).toBe("avatar-current");
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
		} satisfies EditorProject;
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		const renderSection = async (section: ReactNode) => {
			await act(async () => {
				root.render(<EditorProjectForm>{section}</EditorProjectForm>);
			});
		};

		await renderSection(<EditorProjectGeneralSection />);
		const navigation = container.querySelector('[data-ui="EditorSectionNavigation"]');
		const compatibility = container.querySelector<HTMLElement>(
			'[data-ui="EditorCompatibilityNotice"]',
		);
		expect(compatibility?.dataset.level).toBe("none");
		expect(compatibility?.className).toContain("h-28");
		expect(compatibility?.className).toContain("overflow-y-auto");
		const title = container.querySelector<HTMLInputElement>('input[name="title"]');
		if (title === null) throw new Error("Missing project title input.");
		await changeInput(title, "Changed project");
		expect(container.querySelector('[data-ui="EditorCompatibilityNotice"]')).toBe(
			compatibility,
		);
		expect(compatibility?.dataset.level).toBe("minor");
		await renderSection(<div data-ui="AppearanceSection">Appearance</div>);
		await renderSection(<EditorProjectGeneralSection />);

		expect(container.querySelector('[data-ui="EditorSectionNavigation"]')).toBe(navigation);
		expect(container.querySelector<HTMLInputElement>('input[name="title"]')?.value).toBe(
			"Changed project",
		);
	});

	it("reports an inventory shrink as a breaking draft change", async () => {
		state.project = {
			projectId: "project",
			title: editorTestPayload.config.meta.title,
			version: editorTestPayload.version,
			createdAtMs: 1,
			updatedAtMs: 2,
			revision: 0,
			config: {
				...editorTestPayload.config,
				meta: {
					...editorTestPayload.config.meta,
					inventory: {
						width: 3,
						height: 2,
					},
				},
				start: {
					...editorTestPayload.config.start,
					inventory: [
						{
							itemId: "water",
							position: {
								x: 2,
								y: 0,
							},
							quantity: 1,
						},
					],
				},
			},
			resources: editorTestPayload.resources,
		} satisfies EditorProject;
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		roots.push(root);
		await act(async () => {
			root.render(
				<EditorProjectForm>
					<EditorProjectInventorySection />
				</EditorProjectForm>,
			);
		});
		const width = container.querySelector<HTMLInputElement>('input[name="inventory.width"]');
		if (width === null) throw new Error("Missing inventory width input.");

		await changeInput(width, "2");

		const notice = container.querySelector<HTMLElement>(
			'[data-ui="EditorCompatibilityNotice"]',
		);
		expect(notice?.textContent).toContain("Breaking gameplay change");
		expect(notice?.dataset.level).toBe("major");
		expect(notice?.textContent).toContain("inventory width shrank from 3 to 2");
	});
});

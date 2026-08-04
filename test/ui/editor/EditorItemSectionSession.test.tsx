// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@effect/atom-react", () => ({
	useAtomSet: () => vi.fn(),
	useAtomValue: () => state.canonical,
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const original = await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...original,
		useNavigate: () => vi.fn().mockResolvedValue(undefined),
	};
});

vi.mock("~/ui/button/Button", () => ({
	ButtonLink: ({ children }: { readonly children?: ReactNode }) =>
		createElement("a", null, children),
	PrimaryButton: ({ children }: { readonly children?: ReactNode }) =>
		createElement("button", null, children),
}));

const state = vi.hoisted(() => ({
	canonical: undefined as unknown,
	draft: undefined as unknown,
	persisted: undefined as unknown,
}));

vi.mock("~/bridge/editor/useEditorProject", () => ({
	useEditorProject: () => ({
		projectId: "editor-test",
		revision: "revision-1",
		config: {},
	}),
}));

vi.mock("~/bridge/item/editor/saveEditorItemCommandAtom", () => ({
	saveEditorItemCommandAtom: () => ({
		id: "save-editor-item",
	}),
}));

vi.mock("~/bridge/item/editor/useEditorItemDraft", () => ({
	useEditorItemDraft: () => state.draft,
}));

vi.mock("~/ui/item/editor/useEditorItemByUid", () => ({
	useEditorItemByUid: () => state.persisted,
}));

vi.mock("~/ui/resource/editor/EditorAssetAutocompleteField", () => ({
	EditorAssetAutocompleteField: ({ label }: { readonly label: string }) =>
		createElement("span", null, label),
}));

vi.mock("~/ui/item/editor/EditorItemAutocompleteField", () => ({
	EditorItemAutocompleteField: ({ label }: { readonly label: string }) =>
		createElement("span", null, label),
}));

import type { EditorItem } from "~/bridge/item/editor/EditorItemModel";
import { EditorItemForm } from "~/ui/item/editor/EditorItemForm";
import { EditorItemIdentitySection } from "~/ui/item/editor/EditorItemIdentitySection";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const item: EditorItem = {
	uid: "q12cmsx5ussy30wyjiea8yaw",
	id: "item:water",
	type: "simple",
	title: "Water",
	description: "Fresh water.",
	asset: {
		default: [
			"asset:water",
		],
	},
	scope: "any",
	maxStackSize: 1,
};

beforeEach(() => {
	vi.clearAllMocks();
	state.canonical = {
		config: {
			items: {
				[item.id]: item,
			},
		},
	};
	state.draft = item;
	state.persisted = item;
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const render = async (children: ReactNode, itemType?: "simple") => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	const renderForm = async (next: ReactNode) => {
		await act(async () => {
			root.render(
				<EditorItemForm
					itemType={itemType}
					uid={item.uid}
				>
					{next}
				</EditorItemForm>,
			);
		});
	};
	await renderForm(children);
	return {
		container,
		renderForm,
	};
};

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

describe("item section form session", () => {
	it("preserves one local form while routed section content changes", async () => {
		const { container, renderForm } = await render(<EditorItemIdentitySection />);
		const navigation = container.querySelector('[data-ui="EditorSectionNavigation"]');
		const title = container.querySelector<HTMLInputElement>('input[name="title"]');
		if (title === null) throw new Error("Missing title input.");

		await changeInput(title, "Changed water");
		await renderForm(<div data-ui="ArtworkSection">Artwork</div>);
		expect(container.querySelector('[data-ui="ArtworkSection"]')).not.toBeNull();
		await renderForm(<EditorItemIdentitySection />);

		expect(container.querySelector('[data-ui="EditorSectionNavigation"]')).toBe(navigation);
		expect(container.querySelector<HTMLInputElement>('input[name="title"]')?.value).toBe(
			"Changed water",
		);
	});

	it("keeps a persisted item ID read-only", async () => {
		const { container } = await render(<EditorItemIdentitySection />);

		expect(container.querySelector('input[name="id"]')).toBeNull();
		expect(container.textContent).toContain("item:water");
		expect(container.textContent).not.toContain("Immutable after the item is first saved.");
		expect(container.querySelector('[data-ui="EditorInfoTooltip"]')).not.toBeNull();
		expect(container.querySelector('input[name="maxCount"]')).not.toBeNull();
		expect(container.querySelector('input[name="maxStackSize"]')).not.toBeNull();
	});

	it("allows a new item ID to change before its first repository save", async () => {
		state.canonical = {
			config: {
				items: {},
			},
		};
		state.persisted = undefined;
		const { container } = await render(<EditorItemIdentitySection />, "simple");

		const id = container.querySelector<HTMLInputElement>('input[name="id"]');
		expect(id?.value).toBe("item:water");
		expect(container.textContent).not.toContain(
			"The source ID becomes immutable after the first save.",
		);
		expect(container.querySelector('[data-ui="EditorInfoTooltip"]')).not.toBeNull();
	});
});

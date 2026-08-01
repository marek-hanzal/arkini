// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@effect/atom-react", () => ({
	useAtomSet: () => vi.fn(),
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const original = await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...original,
		useNavigate: () => vi.fn().mockResolvedValue(undefined),
	};
});

vi.mock("~/bridge/editor/useEditorProject", () => ({
	useEditorProject: () => ({
		projectId: "editor-test",
		revision: "revision-1",
		config: {
			categories: {
				resource: {
					id: "resource",
					title: "Resource",
				},
			},
		},
	}),
}));

vi.mock("~/ui/editor/EditorFormActions", () => ({
	useRegisterEditorFormActions: () => undefined,
}));

vi.mock("~/ui/item/editor/useSaveEditorItemCommand", () => ({
	useSaveEditorItemCommand: () => ({
		error: undefined,
		mutateAsync: vi.fn(),
		reset: vi.fn(),
	}),
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
	tags: [],
	categoryId: "resource",
	scope: "any",
	maxStackSize: 1,
};

beforeEach(() => vi.clearAllMocks());

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const render = async (children: ReactNode) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	const renderForm = async (next: ReactNode) => {
		await act(async () => {
			root.render(
				<EditorItemForm
					back={null}
					initialItem={item}
					route={{ kind: "edit" }}
					title="Water"
				>
					{next}
				</EditorItemForm>,
			);
		});
	};
	await renderForm(children);
	return { container, renderForm };
};

const changeInput = async (input: HTMLInputElement, value: string) => {
	await act(async () => {
		input.value = value;
		input.dispatchEvent(new Event("input", { bubbles: true }));
	});
};

describe("item section form session", () => {
	it("preserves one local form while routed section content changes", async () => {
		const { container, renderForm } = await render(<EditorItemIdentitySection />);
		const title = container.querySelector<HTMLInputElement>('input[name="title"]');
		if (title === null) throw new Error("Missing title input.");

		await changeInput(title, "Changed water");
		await renderForm(<div data-ui="ArtworkSection">Artwork</div>);
		expect(container.querySelector('[data-ui="ArtworkSection"]')).not.toBeNull();
		await renderForm(<EditorItemIdentitySection />);

		expect(container.querySelector<HTMLInputElement>('input[name="title"]')?.value).toBe(
			"Changed water",
		);
	});
});

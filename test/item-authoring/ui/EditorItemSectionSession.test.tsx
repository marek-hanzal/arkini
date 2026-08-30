// @vitest-environment jsdom

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { act, createElement, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@effect/atom-react", () => ({
	scheduleTask: vi.fn(),
	useAtomSet: () => state.saveItem,
	useAtomValue: () => state.canonical,
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const original = await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...original,
		useNavigate: () => state.navigate,
	};
});

vi.mock("~/ui/button/Button", () => ({
	Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) =>
		createElement("button", props, children),
	ButtonLink: ({ children }: { readonly children?: ReactNode }) =>
		createElement("a", null, children),
	PrimaryButton: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) =>
		createElement("button", props, children),
}));

vi.mock("~/authoring-shell/ui/EditorHistoryBackButton", () => ({
	EditorHistoryBackButton: ({ children }: { readonly children?: ReactNode }) =>
		createElement("span", null, children),
}));

const state = vi.hoisted(() => ({
	canonical: undefined as unknown,
	navigate: vi.fn().mockResolvedValue(undefined),
	persisted: undefined as unknown,
	saveItem: vi.fn(),
	unsavedSession: undefined as
		| {
				readonly save: () => Promise<boolean>;
		  }
		| undefined,
}));

vi.mock("~/authoring-session/ui/useEditorUnsavedChangesRegistration", () => ({
	useEditorUnsavedChangesRegistration: (session: typeof state.unsavedSession) => {
		state.unsavedSession = session;
	},
}));

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		projectId: "editor-test",
		revision: "revision-1",
		version: "1.0",
		resources: [],
		config: (
			state.canonical as {
				config: unknown;
			}
		).config,
	}),
}));

vi.mock("~/item-authoring/ui/useEditorItemByUid", () => ({
	useEditorItemByUid: () => state.persisted,
}));

vi.mock("~/asset-authoring/ui/EditorAssetAutocompleteField", () => ({
	EditorAssetAutocompleteField: ({ label }: { readonly label: string }) =>
		createElement("span", null, label),
}));

vi.mock("~/ui/item/EditorItemAutocompleteField", () => ({
	EditorItemAutocompleteField: ({ label }: { readonly label: string }) =>
		createElement("span", null, label),
}));
import { EditorItemForm } from "~/item-authoring/ui/EditorItemForm";
import { EditorItemIdentitySection } from "~/item-authoring/ui/EditorItemIdentitySection";
import type { EditorItemSectionId } from "~/item-authoring/type/EditorItemSection";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Array<ReturnType<typeof createRoot>> = [];
const item: ItemSchema.Type = {
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
			meta: {
				id: "editor-test",
				title: "Editor test",
				board: {
					width: 2,
					height: 2,
				},
				inventory: {
					width: 2,
					height: 2,
				},
			},
			resources: {
				hero: "hero",
			},
			start: {
				currentSpace: 0,
				board: [],
				inventory: [],
				toolbar: [],
			},
			items: {
				[item.id]: item,
			},
		},
	};
	state.persisted = item;
	state.saveItem.mockResolvedValue(item);
	state.unsavedSession = undefined;
});

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
	const renderSection = async (
		section: ReactNode,
		sectionId: EditorItemSectionId = "identity",
	) => {
		await act(async () => {
			root.render(
				<EditorItemForm
					sectionId={sectionId}
					uid={item.uid}
				>
					{section}
				</EditorItemForm>,
			);
		});
	};
	await renderSection(children);
	return {
		container,
		renderSection,
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
	it("keeps the unsaved-leave Save persistence-only while ordinary Save owns navigation", async () => {
		const { container } = await render(<EditorItemIdentitySection />);
		const title = container.querySelector<HTMLInputElement>('input[name="title"]');
		if (title === null || state.unsavedSession === undefined)
			throw new Error("Missing item form.");

		await changeInput(title, "Saved without leaving");
		await act(async () => {
			await state.unsavedSession?.save();
		});
		expect(state.saveItem).toHaveBeenCalledOnce();
		expect(state.navigate).not.toHaveBeenCalled();

		await changeInput(title, "Saved and leave");
		const saveButton = [
			...container.querySelectorAll("button"),
		].find((button) => button.textContent === "Save");
		await act(async () => {
			saveButton?.click();
			await Promise.resolve();
		});
		expect(state.saveItem).toHaveBeenCalledTimes(2);
		expect(state.saveItem).toHaveBeenLastCalledWith(
			expect.objectContaining({
				title: "Saved and leave",
			}),
		);
		expect(state.navigate).toHaveBeenCalledOnce();
	});

	it("retains the local draft across routed section replacement", async () => {
		const { container, renderSection } = await render(<EditorItemIdentitySection />);
		const title = container.querySelector<HTMLInputElement>('input[name="title"]');
		if (title === null) throw new Error("Missing item title input.");

		await changeInput(title, "Changed water");
		await renderSection(<div>Artwork section</div>, "artwork");
		await renderSection(<EditorItemIdentitySection />, "identity");

		expect(container.querySelector<HTMLInputElement>('input[name="title"]')?.value).toBe(
			"Changed water",
		);
	});
});

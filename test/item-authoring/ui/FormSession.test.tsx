// @vitest-environment jsdom

import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import { act, createElement, memo, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type MockButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
	readonly cursorIntent?: string;
};

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

vi.mock("~/ui/ui/Button", () => ({
	Button: ({ children, cursorIntent: _cursorIntent, ...props }: MockButtonProps) =>
		createElement("button", props, children),
	ButtonLink: ({ children }: { readonly children?: ReactNode }) =>
		createElement("a", null, children),
	PrimaryButton: ({ children, cursorIntent: _cursorIntent, ...props }: MockButtonProps) =>
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
	project: undefined as unknown,
	saveItem: vi.fn(),
	unsavedSession: undefined as
		| {
				readonly saveFn: () => Promise<boolean>;
		  }
		| undefined,
}));

vi.mock("~/authoring-session/ui/useEditorUnsavedChangesRegistration", () => ({
	useEditorUnsavedChangesRegistration: (session: typeof state.unsavedSession) => {
		state.unsavedSession = session;
	},
}));

vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));

vi.mock("~/item-authoring/ui/useItemByUid", () => ({
	useItemByUid: () => state.persisted,
}));

vi.mock("~/authoring-form/ui/AssetAutocompleteField", () => ({
	AssetAutocompleteField: ({ label }: { readonly label: string }) =>
		createElement("span", null, label),
}));

vi.mock("~/authoring-form/ui/EditorItemAutocompleteField", () => ({
	EditorItemAutocompleteField: ({ label }: { readonly label: string }) =>
		createElement("span", null, label),
}));
import { Form } from "~/item-authoring/ui/Form";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { IdentitySection } from "~/item-authoring/ui/IdentitySection";
import type { SectionId } from "~/item-authoring/type/Section";

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
	state.project = {
		projectId: "editor-test",
		revision: "revision-1",
		version: "1.0",
		resources: [],
		config: (
			state.canonical as {
				config: unknown;
			}
		).config,
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
	const renderSection = async (section: ReactNode, sectionId: SectionId = "identity") => {
		await act(async () => {
			root.render(
				<Form
					sectionId={sectionId}
					uid={item.uid}
				>
					{section}
				</Form>,
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
	it("does not republish the form Context when parent inputs are unchanged", async () => {
		let consumerRenders = 0;
		const Probe = memo(() => {
			useFormSession();
			consumerRenders += 1;
			return null;
		});
		const probe = <Probe />;
		const { renderSection } = await render(probe);

		await renderSection(probe);

		expect(consumerRenders).toBe(1);
	});

	it("keeps the unsaved-leave Save persistence-only while ordinary Save owns navigation", async () => {
		const { container } = await render(<IdentitySection />);
		const title = container.querySelector<HTMLInputElement>('input[name="title"]');
		if (title === null || state.unsavedSession === undefined)
			throw new Error("Missing item form.");

		await changeInput(title, "Saved without leaving");
		await act(async () => {
			await state.unsavedSession?.saveFn();
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

	it("discards the local draft and returns an existing item to detail without saving", async () => {
		const { container } = await render(<IdentitySection />);
		const title = container.querySelector<HTMLInputElement>('input[name="title"]');
		if (title === null) throw new Error("Missing item title input.");

		await changeInput(title, "Discarded title");
		const discardButton = [
			...container.querySelectorAll("button"),
		].find((button) => button.textContent === "Discard");
		if (discardButton === undefined) throw new Error("Missing item Discard action.");
		await act(async () => {
			discardButton.click();
			await Promise.resolve();
		});

		expect(title.value).toBe("Water");
		expect(state.saveItem).not.toHaveBeenCalled();
		expect(state.navigate).toHaveBeenCalledWith({
			to: "/editor/$projectId/editor/items/$itemUid/detail/$sectionId",
			params: {
				projectId: "editor-test",
				itemUid: item.uid,
				sectionId: "identity",
			},
			replace: true,
		});
	});

	it("retains the local draft across routed section replacement", async () => {
		const { container, renderSection } = await render(<IdentitySection />);
		const title = container.querySelector<HTMLInputElement>('input[name="title"]');
		if (title === null) throw new Error("Missing item title input.");

		await changeInput(title, "Changed water");
		await renderSection(<div>Artwork section</div>, "artwork");
		await renderSection(<IdentitySection />, "identity");

		expect(container.querySelector<HTMLInputElement>('input[name="title"]')?.value).toBe(
			"Changed water",
		);
	});

	it("keeps the invalid merge selected when validation returns to its section", async () => {
		const itemWithMerges: ItemSchema.Type = {
			...item,
			merge: [
				{
					action: "consume",
					effect: "keep",
					target: {
						itemId: item.id,
						type: "item",
					},
				},
				{
					action: "use",
					effect: "remove",
					target: {
						itemId: item.id,
						type: "item",
					},
				},
			],
		};
		state.persisted = itemWithMerges;
		(
			state.canonical as {
				config: {
					items: Record<string, ItemSchema.Type>;
				};
			}
		).config.items[item.id] = itemWithMerges;
		const InvalidMergeProbe = () => {
			const { form } = useFormSession();
			return (
				<button
					type="button"
					onClick={() => form.setFieldValue("merge[1].target.itemId", "")}
				>
					Invalidate second merge
				</button>
			);
		};
		const { container } = await render(<InvalidMergeProbe />);

		await act(async () => {
			[
				...container.querySelectorAll("button"),
			]
				.find((button) => button.textContent === "Invalidate second merge")
				?.click();
		});
		const saveButton = [
			...container.querySelectorAll("button"),
		].find((button) => button.textContent === "Save");
		await act(async () => {
			saveButton?.click();
			await Promise.resolve();
		});

		expect(state.saveItem).not.toHaveBeenCalled();
		expect(state.navigate).toHaveBeenCalledWith({
			to: "/editor/$projectId/editor/items/$itemUid/form/$sectionId",
			params: {
				projectId: "editor-test",
				itemUid: item.uid,
				sectionId: "merges",
			},
			search: {
				merge: 1,
			},
		});
	});
});

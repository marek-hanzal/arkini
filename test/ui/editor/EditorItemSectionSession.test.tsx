// @vitest-environment jsdom

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
	ButtonLink: ({
		children,
		className,
		params,
		search,
		title,
		to,
	}: {
		readonly children?: ReactNode;
		readonly className?: string;
		readonly params?: Record<string, string>;
		readonly search?: Record<string, string>;
		readonly title?: string;
		readonly to?: string;
	}) =>
		createElement(
			"a",
			{
				className,
				"data-params": JSON.stringify(params),
				"data-search": JSON.stringify(search),
				"data-to": to,
				title,
			},
			children,
		),
	PrimaryButton: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) =>
		createElement("button", props, children),
	PrimaryButtonLink: ({
		children,
		params,
		search,
		to,
	}: {
		readonly children?: ReactNode;
		readonly params?: Record<string, string>;
		readonly search?: Record<string, string>;
		readonly to?: string;
	}) =>
		createElement(
			"a",
			{
				"data-params": JSON.stringify(params),
				"data-search": JSON.stringify(search),
				"data-to": to,
			},
			children,
		),
}));

const state = vi.hoisted(() => ({
	canonical: undefined as unknown,
	draft: undefined as unknown,
	navigate: vi.fn().mockResolvedValue(undefined),
	persisted: undefined as unknown,
	saveItem: vi.fn(),
	unsavedSession: undefined as
		| {
				readonly save: () => Promise<boolean>;
		  }
		| undefined,
}));

vi.mock("~/ui/editor/useEditorUnsavedChangesRegistration", () => ({
	useEditorUnsavedChangesRegistration: (_id: string, session: typeof state.unsavedSession) => {
		state.unsavedSession = session;
	},
}));

vi.mock("~/bridge/editor/useEditorProject", () => ({
	useEditorProject: () => ({
		projectId: "editor-test",
		revision: "revision-1",
		version: "1.0",
		config: (
			state.canonical as {
				config: unknown;
			}
		).config,
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
import { EditorItemArtworkSection } from "~/ui/item/editor/EditorItemArtworkSection";
import { EditorItemChargesSection } from "~/ui/item/editor/EditorItemChargesSection";
import { EditorItemDetailSectionPage } from "~/ui/item/editor/EditorItemDetailSectionPage";
import { EditorItemForm } from "~/ui/item/editor/EditorItemForm";
import { EditorItemIdentitySection } from "~/ui/item/editor/EditorItemIdentitySection";
import { EditorItemMergesSection } from "~/ui/item/editor/EditorItemMergesSection";
import type { EditorItemOptionalCapability } from "~/ui/item/editor/EditorItemSections";

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
	state.draft = item;
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

const render = async (
	children: ReactNode,
	itemType?: "simple",
	enableCapability?: EditorItemOptionalCapability,
) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	const renderForm = async (next: ReactNode) => {
		await act(async () => {
			root.render(
				<EditorItemForm
					enableCapability={enableCapability}
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

const renderStandalone = async (children: ReactNode) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => root.render(children));
	return container;
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
		expect(state.navigate).toHaveBeenCalledOnce();
	});

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

	it("selects a progress asset from its artwork timeline thumbnail", async () => {
		const artworkItem: EditorItem = {
			...item,
			asset: {
				default: [
					"asset:water",
				],
				sources: [
					"asset:water-half",
					"asset:water-empty",
				],
			},
		};
		state.canonical = {
			config: {
				items: {
					[item.id]: artworkItem,
				},
			},
		};
		state.draft = artworkItem;
		state.persisted = artworkItem;

		const { container } = await render(<EditorItemArtworkSection />);
		const selector = container.querySelector<HTMLInputElement>(
			'input[aria-label="Progress assets"]',
		);
		const secondThumbnail = container.querySelector<HTMLButtonElement>(
			'button[title="Select progress asset 2"]',
		);
		if (selector === null || secondThumbnail === null)
			throw new Error("Missing artwork progress selector controls.");

		expect(selector.value).toBe("asset:water-half");
		await act(async () => secondThumbnail.click());
		expect(selector.value).toBe("asset:water-empty");
	});

	it("links read-only artwork assets and shows the complete progress timeline", async () => {
		state.persisted = {
			...item,
			asset: {
				default: [
					"asset:water",
					"asset:water-overlay",
				],
				sources: [
					"asset:water-half",
					"asset:water-empty",
				],
			},
		};

		const container = await renderStandalone(
			<EditorItemDetailSectionPage
				sectionId="artwork"
				uid={item.uid}
			/>,
		);
		const halfLinks = container.querySelectorAll<HTMLAnchorElement>(
			'a[title="Open asset asset:water-half"]',
		);

		expect(halfLinks.length).toBeGreaterThan(0);
		expect(halfLinks[0]?.dataset.to).toBe(
			"/editor/$projectId/assets/$resourceId/detail/overview",
		);
		expect(halfLinks[0]?.dataset.search).toBe(
			JSON.stringify({
				filter: "all",
				query: "asset:water-half",
			}),
		);
		expect(container.textContent).toContain("Default composition");
		expect(container.textContent).toContain("0%");
		expect(container.textContent).toContain("50%");
		expect(container.textContent).toContain("100%");
	});

	it("opens disabled charges as an initialized local form in one action", async () => {
		const detail = await renderStandalone(
			<EditorItemDetailSectionPage
				sectionId="charges"
				uid={item.uid}
			/>,
		);
		const action = Array.from(detail.querySelectorAll<HTMLAnchorElement>("a")).find(
			(link) => link.textContent === "Enable charges",
		);
		expect(action?.dataset.to).toBe("/editor/$projectId/editor/items/$itemUid/form/$sectionId");
		expect(action?.dataset.search).toBe(
			JSON.stringify({
				enable: "charges",
			}),
		);

		const { container } = await render(<EditorItemChargesSection />, undefined, "charges");
		expect(container.textContent).toContain("Initial charges");
		expect(container.textContent).not.toContain("Charges are disabled");
	});

	it("opens disabled merges as an initialized local form in one action", async () => {
		const detail = await renderStandalone(
			<EditorItemDetailSectionPage
				sectionId="merges"
				uid={item.uid}
			/>,
		);
		const action = Array.from(detail.querySelectorAll<HTMLAnchorElement>("a")).find(
			(link) => link.textContent === "Enable merges",
		);
		expect(action?.dataset.search).toBe(
			JSON.stringify({
				enable: "merges",
			}),
		);

		const { container } = await render(<EditorItemMergesSection />, undefined, "merges");
		expect(container.textContent).toContain("Merges");
		expect(container.textContent).not.toContain("Merges are disabled");
	});

	it("explains when a deposit has no production lines", async () => {
		state.persisted = {
			...item,
			id: "deposit:tree",
			type: "deposit",
			scope: "board",
			charges: {
				amount: 3,
			},
		};

		const container = await renderStandalone(
			<EditorItemDetailSectionPage
				sectionId="production"
				uid={item.uid}
			/>,
		);

		expect(container.textContent).toContain("Production lines are disabled");
		expect(container.textContent).toContain("cannot run production jobs");
		expect(
			container.querySelector('[data-ui="EditorProductionLinesDisabledStatus"]'),
		).not.toBeNull();
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

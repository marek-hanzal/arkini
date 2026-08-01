// @vitest-environment jsdom

import { act, createElement, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EditorCreateItemForm } from "~/ui/item/editor/EditorCreateItemForm";
import { EditorEditItemForm } from "~/ui/item/editor/EditorEditItemForm";
import { EditorItemView } from "~/ui/item/editor/EditorItemView";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

const state = vi.hoisted(() => ({
	formProps: undefined as unknown,
	navigate: vi.fn(),
	project: undefined as unknown,
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
	const original = await importOriginal<typeof import("@tanstack/react-router")>();
	return {
		...original,
		useNavigate: () => state.navigate,
	};
});

vi.mock("~/bridge/editor/useEditorProject", () => ({
	useEditorProject: () => state.project,
}));

vi.mock("~/ui/item/editor/EditorItemForm", () => ({
	EditorItemForm: (props: unknown) => {
		state.formProps = props;
		return createElement("output", {
			"data-ui": "EditorItemForm",
		});
	},
}));

vi.mock("~/ui/item/editor/EditorItemThumbnail", () => ({
	EditorItemThumbnail: () =>
		createElement("span", {
			"data-ui": "EditorItemThumbnail",
		}),
}));

const renderLink = ({
	children,
	params,
	to,
}: {
	readonly children?: ReactNode;
	readonly params?: unknown;
	readonly to?: string;
}) =>
	createElement(
		"a",
		{
			"data-params": JSON.stringify(params),
			"data-to": to,
		},
		children,
	);

vi.mock("~/ui/button/Button", () => ({
	ButtonLink: renderLink,
	PrimaryButtonLink: renderLink,
}));

const roots: Array<ReturnType<typeof createRoot>> = [];
const item = {
	uid: "stable-item-uid",
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
} as const;

beforeEach(() => {
	state.formProps = undefined;
	state.navigate.mockReset().mockResolvedValue(undefined);
	state.project = {
		projectId: "editor-test",
		title: "Editor test",
		resources: [
			{
				id: "asset:water",
				bytes: new Uint8Array(),
			},
		],
		config: {
			categories: {
				resource: {
					id: "resource",
					title: "Resource",
				},
			},
			items: {
				[item.id]: item,
			},
		},
	};
});

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const render = async (element: ReactNode) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(element);
	});
	return container;
};

describe("editor item flow", () => {
	it("opens canonical items in read-only view before offering explicit Edit", async () => {
		const container = await render(createElement(EditorItemView, { uid: item.uid }));
		const edit = container.querySelector<HTMLAnchorElement>(
			'[data-to="/editor/$projectId/editor/items/$itemUid/edit/identity"]',
		);

		expect(container.textContent).toContain("Water");
		expect(container.textContent).toContain("Fresh water.");
		expect(edit?.dataset.params).toContain(item.uid);
	});

	it("initializes edit from the canonical UID and returns to its view after save", async () => {
		await render(createElement(EditorEditItemForm, { uid: item.uid }));
		const props = state.formProps as {
			readonly initialItem: typeof item;
			readonly onSaved: (saved: typeof item) => Promise<void>;
			readonly route: { readonly kind: "edit" };
		};

		expect(props.initialItem).toBe(item);
		expect(props.route).toEqual({ kind: "edit" });
		await props.onSaved(item);
		expect(state.navigate).toHaveBeenCalledWith({
			to: "/editor/$projectId/editor/items/$itemUid/view",
			params: {
				projectId: "editor-test",
				itemUid: item.uid,
			},
			replace: true,
		});
	});

	it("creates only a local form value until the new UID is saved", async () => {
		await render(
			createElement(EditorCreateItemForm, {
				itemType: "simple",
				uid: "new-item-uid",
			}),
		);
		const props = state.formProps as {
			readonly initialItem: typeof item;
			readonly onSaved: (saved: typeof item) => Promise<void>;
			readonly route: { readonly kind: "create"; readonly itemType: "simple" };
		};

		expect(props.initialItem.uid).toBe("new-item-uid");
		expect(props.route).toEqual({ kind: "create", itemType: "simple" });
		expect(props.initialItem.type).toBe("simple");
		expect(
			(state.project as { readonly config: { readonly items: Record<string, unknown> } })
				.config.items,
		).toEqual({
			[item.id]: item,
		});
	});
});

// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { EditorSearchOption } from "~/editor-control/ui/EditorSearchCombobox";
const state = vi.hoisted(() => ({
	copyFn: vi.fn(),
	items: {} as Record<string, ItemSchema.Type>,
}));
vi.mock("~/item-authoring/ui/FormContext", () => ({
	useFormSession: () => ({
		initialItem: {
			uid: "destination-uid",
		},
		itemId: "renamed",
		copySectionFn: state.copyFn,
		isSaving: false,
	}),
}));
vi.mock("~/authoring-session/ui/useEditorProject", () => ({
	useEditorProject: () => ({
		config: {
			items: state.items,
		},
	}),
}));
vi.mock("~/authoring-form/ui/EditorItemThumbnail", () => ({
	EditorItemSearchThumbnail: () => null,
}));
vi.mock("~/translation/ui/useTranslator", () => ({
	useTranslator: () => ({
		textFn: (label: string) => label,
	}),
}));
vi.mock("~/editor-control/ui/EditorSearchCombobox", () => ({
	EditorSearchCombobox: ({
		options,
		onChangeFn,
	}: {
		options: EditorSearchOption[];
		onChangeFn: (id: string) => void;
	}) => (
		<div>
			{options.map((option) => (
				<button
					key={option.id}
					data-source={option.id}
					onClick={() => onChangeFn(option.id)}
				>
					{option.label}
				</button>
			))}
		</div>
	),
}));
import { ItemSectionCopyControl } from "~/item-authoring/ui/ItemSectionCopyControl";
(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;
const roots: ReturnType<typeof createRoot>[] = [];
afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
	state.copyFn.mockReset();
});
it("excludes the destination by UID and copies only the confirmed source snapshot", async () => {
	const source = ItemSchema.parse({
		uid: "source-uid",
		id: "source",
		title: "Source",
		artwork: {
			scale: 1,
			default: [
				"art",
			],
		},
		scope: "board",
		maxStackSize: 1,
		clock: {
			durationMs: 300000,
			enable: true,
			rules: [],
		},
	});
	state.items = {
		source,
		destination: {
			...source,
			uid: "destination-uid",
			id: "destination",
		},
	};
	const root = createRoot(document.body.appendChild(document.createElement("div")));
	roots.push(root);
	await act(async () => root.render(<ItemSectionCopyControl sectionId="clock" />));
	expect(document.querySelector('[data-source="destination"]')).toBeNull();
	await act(async () =>
		document.querySelector<HTMLButtonElement>('[data-source="source"]')?.click(),
	);
	expect(state.copyFn).not.toHaveBeenCalled();
	const cancel = Array.from(document.querySelectorAll("button")).find((button) =>
		button.textContent?.includes("Cancel"),
	);
	await act(async () => cancel?.click());
	expect(document.querySelector('[data-ui="ItemSectionCopyDialog"]')).toBeNull();
	expect(state.copyFn).not.toHaveBeenCalled();
	await act(async () =>
		document.querySelector<HTMLButtonElement>('[data-source="source"]')?.click(),
	);
	state.items.source = {
		...source,
		clock: undefined,
	};
	await act(async () =>
		document.querySelector<HTMLButtonElement>('[data-ui="ItemSectionCopyConfirm"]')?.click(),
	);
	expect(state.copyFn).toHaveBeenCalledExactlyOnceWith(source, "clock");
	expect(state.copyFn.mock.calls[0][0]).not.toBe(source);
	expect(document.querySelector('[data-ui="ItemSectionCopyDialog"]')).toBeNull();
});

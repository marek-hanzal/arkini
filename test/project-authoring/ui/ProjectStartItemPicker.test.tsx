// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ProjectStartItemPicker } from "~/project-authoring/ui/ProjectStartItemPicker";
import { startTestConfig } from "~test/game-start/support/startTestConfig";
import { TranslationTestProvider } from "~test/support/TranslationTestProvider";

(
	globalThis as {
		IS_REACT_ACT_ENVIRONMENT?: boolean;
	}
).IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("~/authoring-form/ui/useEditorItemSearchOptions", async () => {
	const { startTestConfig } = await import("~test/game-start/support/startTestConfig");
	return {
		useEditorItemSearchOptions: () => ({
			items: startTestConfig.items,
			options: Object.values(startTestConfig.items).map((item) => ({
				id: item.id,
				label: item.title,
				meta: item.id,
				terms: [
					item.id,
					item.title,
				],
			})),
		}),
	};
});

vi.mock("~/authoring-form/ui/EditorItemThumbnail", () => ({
	EditorItemSearchThumbnail: ({
		item,
	}: {
		readonly item?: {
			readonly id: string;
		};
	}) => <span data-thumbnail-item-id={item?.id} />,
}));

const roots: Array<ReturnType<typeof createRoot>> = [];

afterEach(async () => {
	await act(async () => {
		for (const root of roots.splice(0)) root.unmount();
	});
	document.body.replaceChildren();
});

const PickerHarness = ({
	onSelect,
	scope = "inventory",
	start = startTestConfig.start,
}: {
	readonly onSelect: (itemId: string) => void;
	readonly scope?: "board" | "inventory" | "toolbar";
	readonly start?: typeof startTestConfig.start;
}) => {
	const [open, setOpen] = useState(false);
	return (
		<>
			<button
				data-ui="PickerOpener"
				onClick={() => setOpen(true)}
				type="button"
			>
				Open
			</button>
			{open ? (
				<ProjectStartItemPicker
					onCloseFn={() => setOpen(false)}
					onSelectFn={onSelect}
					scope={scope}
					start={start}
				/>
			) : null}
		</>
	);
};

const renderPicker = async (
	onSelect: (itemId: string) => void,
	props?: Omit<Parameters<typeof PickerHarness>[0], "onSelect">,
) => {
	const container = document.createElement("div");
	document.body.append(container);
	const root = createRoot(container);
	roots.push(root);
	await act(async () => {
		root.render(
			<TranslationTestProvider>
				<PickerHarness
					{...props}
					onSelect={onSelect}
				/>
			</TranslationTestProvider>,
		);
	});
	const opener = container.querySelector<HTMLButtonElement>('[data-ui="PickerOpener"]');
	if (opener === null) throw new Error("Expected picker opener.");
	await act(async () => {
		opener.focus();
		opener.click();
	});
	return {
		container,
		opener,
	};
};

describe("ProjectStartItemPicker", () => {
	it("admits only the requested scope and restores focus after exact selection", async () => {
		const onSelect = vi.fn();
		const { container, opener } = await renderPicker(onSelect);
		const search = container.querySelector<HTMLInputElement>('input[type="search"]');
		if (search === null) throw new Error("Expected Spotlight search input.");
		expect(document.activeElement).toBe(search);
		expect(
			Array.from(container.querySelectorAll<HTMLButtonElement>("button[data-item-id]"))
				.map((option) => option.dataset.itemId)
				.sort(),
		).toEqual([
			"lens",
			"log",
		]);

		const lens = container.querySelector<HTMLButtonElement>('button[data-item-id="lens"]');
		if (lens === null) throw new Error("Expected admitted lens option.");
		await act(async () => lens.click());

		expect(onSelect).toHaveBeenCalledExactlyOnceWith("lens");
		expect(container.querySelector('[data-ui="EditorProjectStartItemPicker"]')).toBeNull();
		expect(document.activeElement).toBe(opener);
	});

	it("closes only from the backdrop surface", async () => {
		const { container, opener } = await renderPicker(vi.fn());
		const spotlight = container.querySelector<HTMLElement>(
			'[data-ui="EditorProjectStartItemPicker"]',
		);
		const backdrop = container.querySelector<HTMLElement>(
			'[data-ui="EditorProjectStartItemPickerBackdrop"]',
		);
		if (spotlight === null || backdrop === null) throw new Error("Expected mounted Spotlight.");

		await act(async () => {
			spotlight.dispatchEvent(
				new MouseEvent("pointerdown", {
					bubbles: true,
				}),
			);
		});
		expect(container.querySelector('[data-ui="EditorProjectStartItemPicker"]')).not.toBeNull();
		await act(async () => {
			backdrop.dispatchEvent(
				new MouseEvent("pointerdown", {
					bubbles: true,
				}),
			);
		});
		expect(container.querySelector('[data-ui="EditorProjectStartItemPicker"]')).toBeNull();
		expect(document.activeElement).toBe(opener);
	});

	it("keeps a scope-compatible item visible but inert after reaching max count", async () => {
		const onSelect = vi.fn();
		const { container } = await renderPicker(onSelect, {
			scope: "toolbar",
			start: {
				currentSpace: 0,
				board: [
					{
						itemId: "backpack",
						space: 0,
						x: 0,
						y: 0,
					},
				],
				inventory: [],
				toolbar: [],
			},
		});
		const backpack = container.querySelector<HTMLButtonElement>(
			'button[data-item-id="backpack"]',
		);
		if (backpack === null) throw new Error("Expected visible Backpack option.");

		expect(backpack.disabled).toBe(true);
		expect(
			backpack.querySelector('[data-ui="ItemSpotlightOptionDisabledReason"]'),
		).not.toBeNull();
		await act(async () => backpack.click());
		expect(onSelect).not.toHaveBeenCalled();
		expect(container.querySelector('[data-ui="EditorProjectStartItemPicker"]')).not.toBeNull();
	});
});

import { useEffect, useMemo, useRef, useState } from "react";

import type { EditorProjectStartScope } from "~/bridge/project/editor/EditorProjectStartScope";
import { readEditorProjectStartItemIdsFx } from "~/bridge/project/editor/readEditorProjectStartItemIdsFx";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { EditorItemSearchThumbnail } from "~/ui/item/editor/EditorItemThumbnail";
import { useEditorItemSearchOptions } from "~/ui/item/editor/useEditorItemSearchOptions";
import { SpotlightSearchInput } from "~/ui/search/SpotlightSearchInput";
import { useFuseSearch } from "~/ui/search/useFuseSearch";

export interface EditorProjectStartItemPickerProps {
	readonly onClose: () => void;
	readonly onSelect: (itemId: string) => void;
	readonly scope: EditorProjectStartScope;
}

/** Selects one canonical item allowed in the requested initial grid scope. */
export const EditorProjectStartItemPicker = ({
	onClose,
	onSelect,
	scope,
}: EditorProjectStartItemPickerProps) => {
	const { items, options } = useEditorItemSearchOptions();
	const inputRef = useRef<HTMLInputElement>(null);
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const allowedItemIds = useMemo(
		() =>
			RendererRuntime.runSync(
				readEditorProjectStartItemIdsFx({
					items,
					scope,
				}),
			),
		[
			items,
			scope,
		],
	);
	const allowedOptions = useMemo(
		() => options.filter(({ id }) => allowedItemIds.has(id)),
		[
			allowedItemIds,
			options,
		],
	);
	const candidates = useMemo(
		() =>
			allowedOptions.map(({ id, terms }) => ({
				identity: id,
				terms,
			})),
		[
			allowedOptions,
		],
	);
	const matchingIds = useFuseSearch(candidates, query);
	const optionsById = useMemo(
		() =>
			new Map(
				allowedOptions.map((option) => [
					option.id,
					option,
				]),
			),
		[
			allowedOptions,
		],
	);
	const results = matchingIds.flatMap((id) => {
		const option = optionsById.get(id);
		return option === undefined
			? []
			: [
					option,
				];
	});

	useEffect(() => {
		inputRef.current?.focus();
	}, []);
	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Escape") return;
			event.preventDefault();
			onClose();
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [
		onClose,
	]);

	const choose = (itemId: string) => {
		onSelect(itemId);
		onClose();
	};

	return (
		<div
			className="fixed inset-0 z-[80] grid place-items-start overflow-hidden bg-overlay/70 p-[var(--ak-viewport-padding)] pt-[12vh]"
			data-ui="EditorProjectStartItemPickerBackdrop"
			onPointerDown={(event) => {
				if (event.currentTarget === event.target) onClose();
			}}
		>
			<section
				aria-labelledby="editor-start-item-picker-title"
				aria-modal="true"
				className="mx-auto grid w-[38rem] max-w-full gap-3 rounded-2xl border border-line-strong bg-surface-raised p-4 text-foreground shadow-2xl"
				data-ui="EditorProjectStartItemPicker"
				role="dialog"
			>
				<h2
					className="sr-only"
					id="editor-start-item-picker-title"
				>
					Select initial item
				</h2>
				<SpotlightSearchInput
					ariaLabel="Search initial items"
					inputRef={inputRef}
					onEnter={() => {
						const selected = results[selectedIndex];
						if (selected !== undefined) choose(selected.id);
					}}
					onQueryChange={(value) => {
						setQuery(value);
						setSelectedIndex(0);
					}}
					onSelectedIndexChange={setSelectedIndex}
					query={query}
					resultCount={results.length}
					selectedIndex={selectedIndex}
				/>
				<div className="grid max-h-[26rem] gap-1 overflow-y-auto">
					{results.length === 0 ? (
						<p className="px-3 py-6 text-center text-sm text-muted">
							No items can be placed here.
						</p>
					) : (
						results.map((option, index) => (
							<button
								className="ak-spotlight-option grid grid-cols-[3rem_1fr] items-center gap-3 rounded-lg border px-3 py-2 text-left"
								data-selected={index === selectedIndex ? "true" : undefined}
								key={option.id}
								onClick={() => choose(option.id)}
								onMouseEnter={() => setSelectedIndex(index)}
								type="button"
							>
								<EditorItemSearchThumbnail item={items[option.id]} />
								<span className="min-w-0">
									<span className="block truncate text-sm font-semibold">
										{option.label}
									</span>
									<span className="ak-spotlight-option-secondary block truncate text-xs">
										{option.meta ?? option.id}
									</span>
								</span>
							</button>
						))
					)}
				</div>
				<p className="text-center text-xs text-muted">
					↑↓ select · Enter choose · Esc close
				</p>
			</section>
		</div>
	);
};

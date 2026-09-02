import { Check, Search, X } from "lucide-react";

import {
	autoUpdate,
	flip,
	FloatingPortal,
	offset,
	shift,
	size,
	useFloating,
} from "@floating-ui/react";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { EditorInfoTooltip } from "~/editor-control/ui/EditorInfoTooltip";
import { useFuseSearch } from "~/ui/ui/useFuseSearch";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";

export interface EditorSearchOption {
	readonly id: string;
	readonly label: string;
	readonly meta?: string;
	readonly terms: readonly string[];
}

interface EditorSearchComboboxProps {
	readonly displaySelectedLabel?: boolean;
	readonly label: string;
	readonly labelVisible?: boolean;
	readonly description?: string;
	readonly emptyLabel: string;
	readonly error?: string;
	readonly options: readonly EditorSearchOption[];
	readonly placeholder?: string;
	readonly value: string;
	readonly onBlurFn?: () => void;
	readonly onChangeFn: (value: string) => void;
	readonly onInputChangeFn?: (value: string) => void;
	readonly optionContentLayout?: "inline" | "stacked";
	readonly renderOptionContentFn?: (option: EditorSearchOption) => ReactNode;
	readonly renderPreviewFn: (option: EditorSearchOption) => ReactNode;
	readonly renderSelectedPreviewFn?: (option: EditorSearchOption) => ReactNode;
}

/** One keyboard-friendly Fuse-backed picker shared by item and asset form fields. */
export const EditorSearchCombobox = ({
	description,
	displaySelectedLabel = false,
	emptyLabel,
	error,
	label,
	labelVisible = true,
	onBlurFn,
	onChangeFn,
	onInputChangeFn,
	optionContentLayout = "stacked",
	options,
	placeholder,
	renderOptionContentFn,
	renderPreviewFn,
	renderSelectedPreviewFn,
	value,
}: EditorSearchComboboxProps) => {
	const selectedOption = options.find((option) => option.id === value);
	const selectedPreview =
		selectedOption === undefined ? undefined : renderSelectedPreviewFn?.(selectedOption);
	const selectedLabel = displaySelectedLabel
		? (options.find((option) => option.id === value)?.label ?? value)
		: value;
	const [query, setQueryFn] = useState(selectedLabel);
	const [open, setOpenFn] = useState(false);
	const [activeIndex, setActiveIndexFn] = useState(0);
	const { floatingStyles, refs } = useFloating({
		open,
		onOpenChange: setOpenFn,
		placement: "bottom-start",
		middleware: [
			offset(4),
			flip(),
			shift({
				padding: 8,
			}),
			size({
				padding: 8,
				apply: ({ availableHeight, elements, rects }) => {
					elements.floating.style.width = `${rects.reference.width}px`;
					elements.floating.style.maxHeight = `${Math.min(288, availableHeight)}px`;
				},
			}),
		],
		whileElementsMounted: autoUpdate,
	});
	const candidates = useMemo(
		() =>
			options.map(({ id, terms }) => ({
				identity: id,
				terms,
			})),
		[
			options,
		],
	);
	const matchingIds = useFuseSearch(candidates, query);
	const optionsById = useMemo(
		() =>
			new Map(
				options.map((option) => [
					option.id,
					option,
				]),
			),
		[
			options,
		],
	);
	const matches = matchingIds.flatMap((id) => {
		const option = optionsById.get(id);
		return option === undefined
			? []
			: [
					option,
				];
	});

	useEffect(() => {
		setQueryFn(selectedLabel);
	}, [
		selectedLabel,
	]);
	useEffect(() => {
		setActiveIndexFn(0);
	}, [
		query,
	]);

	const chooseFn = (option: EditorSearchOption) => {
		onChangeFn(option.id);
		setQueryFn(displaySelectedLabel ? option.label : option.id);
		setOpenFn(false);
	};
	const beginSearchFn = () => {
		if (!open && query === selectedLabel) setQueryFn("");
		setOpenFn(true);
	};

	return (
		<label className="grid min-w-0 content-start gap-1.5 text-sm">
			{labelVisible ? (
				<span className="flex min-w-0 items-center gap-1">
					<span className="font-semibold text-foreground">{label}</span>
					{description === undefined ? null : <EditorInfoTooltip content={description} />}
				</span>
			) : null}
			<span className="flex min-w-0 items-center gap-2">
				{selectedPreview === undefined || selectedPreview === null ? null : (
					<span
						className="shrink-0"
						data-ui="EditorSearchSelectedPreview"
					>
						{selectedPreview}
					</span>
				)}
				<span
					ref={refs.setReference}
					className="relative min-w-0 flex-1"
				>
					<Search className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-subtle" />
					<input
						type="search"
						value={query}
						autoComplete="off"
						className="ak-editor-search-input min-h-[var(--ak-control-min-height)] w-full rounded-lg border border-line-strong bg-canvas/70 py-2 pr-12 pl-9 text-sm text-foreground outline-none transition-colors placeholder:text-subtle"
						placeholder={placeholder ?? `Search ${label.toLocaleLowerCase()}…`}
						onBlur={() => {
							setOpenFn(false);
							setQueryFn(selectedLabel);
							onBlurFn?.();
						}}
						onChange={(event) => {
							const value = event.currentTarget.value;
							setQueryFn(value);
							onInputChangeFn?.(value);
							setOpenFn(true);
						}}
						onClick={beginSearchFn}
						onFocus={beginSearchFn}
						onKeyDown={(event) => {
							if (event.key === "Escape") {
								setOpenFn(false);
								setQueryFn(selectedLabel);
								return;
							}
							if (event.key === "ArrowDown" || event.key === "ArrowUp") {
								event.preventDefault();
								setOpenFn(true);
								setActiveIndexFn((current) => {
									if (matches.length === 0) return 0;
									const offset = event.key === "ArrowDown" ? 1 : -1;
									return (current + offset + matches.length) % matches.length;
								});
								return;
							}
							if (
								event.key === "Enter" &&
								open &&
								matches[activeIndex] !== undefined
							) {
								event.preventDefault();
								chooseFn(matches[activeIndex]);
							}
						}}
						{...readDataUiFn({
							dataUi: "EditorSearchComboboxInput",
							state: {
								invalid: error !== undefined,
							},
						})}
					/>
					{query.length === 0 ? null : (
						<button
							type="button"
							className="absolute inset-y-0 right-0 grid w-12 cursor-pointer place-items-center rounded-r-lg border-y border-r border-transparent text-muted hover:border-line-strong hover:bg-surface-raised hover:text-foreground"
							title="Clear search"
							onMouseDown={(event) => event.preventDefault()}
							onClick={() => {
								setQueryFn("");
								onInputChangeFn?.("");
								setOpenFn(true);
							}}
						>
							<X className="size-5" />
						</button>
					)}
				</span>
			</span>
			{error === undefined ? null : (
				<span className="text-xs leading-5 text-danger">{error}</span>
			)}
			{open ? (
				<FloatingPortal>
					<span
						ref={refs.setFloating}
						style={floatingStyles}
						className="z-50 grid gap-1 overflow-y-auto rounded-xl border border-line-strong bg-surface p-1.5 shadow-2xl"
					>
						{matches.length === 0 ? (
							<span className="px-3 py-4 text-center text-xs text-muted">
								{emptyLabel}
							</span>
						) : null}
						{matches.map((option, index) => (
							<button
								key={option.id}
								type="button"
								className="flex min-w-0 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-surface-raised data-[ui-active=true]:bg-surface-raised"
								onMouseDown={(event) => event.preventDefault()}
								onMouseEnter={() => setActiveIndexFn(index)}
								onClick={() => chooseFn(option)}
								{...readDataUiFn({
									dataUi: "EditorSearchComboboxOption",
									state: {
										active: index === activeIndex,
										selected: option.id === value,
									},
								})}
							>
								{renderPreviewFn(option)}
								{renderOptionContentFn === undefined ? (
									<span
										className="min-w-0 flex-1 data-[ui-layout=inline]:flex data-[ui-layout=inline]:items-center data-[ui-layout=inline]:gap-1.5"
										data-ui-layout={optionContentLayout}
									>
										<span
											className="block truncate text-sm font-semibold text-foreground data-[ui-layout=inline]:shrink-0"
											data-ui-layout={optionContentLayout}
										>
											{option.label}
										</span>
										{option.meta === undefined ? null : (
											<>
												<span
													className="hidden shrink-0 text-subtle data-[ui-layout=inline]:inline"
													data-ui-layout={optionContentLayout}
												>
													·
												</span>
												<span
													className="mt-0.5 block truncate text-xs text-subtle data-[ui-layout=inline]:mt-0 data-[ui-layout=inline]:min-w-0 data-[ui-layout=inline]:flex-1 data-[ui-layout=inline]:text-sm"
													data-ui-layout={optionContentLayout}
												>
													{option.meta}
												</span>
											</>
										)}
									</span>
								) : (
									renderOptionContentFn(option)
								)}
								{option.id === value ? (
									<Check className="size-4 shrink-0 text-accent" />
								) : null}
							</button>
						))}
					</span>
				</FloatingPortal>
			) : null}
		</label>
	);
};

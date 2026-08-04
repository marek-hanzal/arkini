import {
	autoUpdate,
	flip,
	FloatingPortal,
	offset,
	shift,
	size,
	useFloating,
} from "@floating-ui/react";
import { useEffect, useId, useMemo, useState, type ReactNode } from "react";

import { useFuseSearch } from "~/ui/search/useFuseSearch";

export interface EditorSearchOption {
	readonly id: string;
	readonly label: string;
	readonly meta?: string;
	readonly terms: readonly string[];
}

export namespace EditorSearchCombobox {
	export interface Props {
		readonly displaySelectedLabel?: boolean;
		readonly label: string;
		readonly labelVisible?: boolean;
		readonly description?: string;
		readonly emptyLabel: string;
		readonly error?: string;
		readonly options: readonly EditorSearchOption[];
		readonly value: string;
		readonly onBlur?: () => void;
		readonly onChange: (value: string) => void;
		readonly renderPreview: (option: EditorSearchOption) => ReactNode;
	}
}

/** One keyboard-friendly Fuse-backed picker shared by item and asset form fields. */
export const EditorSearchCombobox = ({
	description,
	displaySelectedLabel = false,
	emptyLabel,
	error,
	label,
	labelVisible = true,
	onBlur,
	onChange,
	options,
	renderPreview,
	value,
}: EditorSearchCombobox.Props) => {
	const selectedLabel = displaySelectedLabel
		? (options.find((option) => option.id === value)?.label ?? value)
		: value;
	const [query, setQuery] = useState(selectedLabel);
	const [open, setOpen] = useState(false);
	const [activeIndex, setActiveIndex] = useState(0);
	const listboxId = useId();
	const { floatingStyles, refs } = useFloating({
		open,
		onOpenChange: setOpen,
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
		setQuery(selectedLabel);
	}, [
		selectedLabel,
	]);
	useEffect(() => {
		setActiveIndex(0);
	}, [
		query,
	]);

	const choose = (option: EditorSearchOption) => {
		onChange(option.id);
		setQuery(displaySelectedLabel ? option.label : option.id);
		setOpen(false);
	};

	return (
		<label className="grid min-w-0 content-start gap-1.5 text-sm">
			{labelVisible ? <span className="font-semibold text-foreground">{label}</span> : null}
			<span
				ref={refs.setReference}
				className="relative"
			>
				<span className="icon-[lucide--search] pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-subtle" />
				<input
					type="search"
					role="combobox"
					value={query}
					autoComplete="off"
					aria-expanded={open}
					aria-controls={listboxId}
					aria-invalid={error === undefined ? undefined : true}
					aria-activedescendant={
						open && matches[activeIndex] !== undefined
							? `${listboxId}-option-${activeIndex}`
							: undefined
					}
					aria-label={label}
					className="min-h-[var(--ak-control-min-height)] w-full rounded-lg border border-line-strong bg-canvas/70 py-2 pr-3 pl-9 text-sm text-foreground outline-none transition-colors placeholder:text-subtle"
					placeholder={`Search ${label.toLocaleLowerCase()}…`}
					onBlur={() => {
						setOpen(false);
						setQuery(selectedLabel);
						onBlur?.();
					}}
					onChange={(event) => {
						setQuery(event.currentTarget.value);
						setOpen(true);
					}}
					onFocus={() => setOpen(true)}
					onKeyDown={(event) => {
						if (event.key === "Escape") {
							setOpen(false);
							setQuery(selectedLabel);
							return;
						}
						if (event.key === "ArrowDown" || event.key === "ArrowUp") {
							event.preventDefault();
							setOpen(true);
							setActiveIndex((current) => {
								if (matches.length === 0) return 0;
								const offset = event.key === "ArrowDown" ? 1 : -1;
								return (current + offset + matches.length) % matches.length;
							});
							return;
						}
						if (event.key === "Enter" && open && matches[activeIndex] !== undefined) {
							event.preventDefault();
							choose(matches[activeIndex]);
						}
					}}
				/>
			</span>
			{description === undefined ? null : (
				<span className="text-xs leading-5 text-subtle">{description}</span>
			)}
			{error === undefined ? null : (
				<span className="text-xs leading-5 text-danger">{error}</span>
			)}
			{open ? (
				<FloatingPortal>
					<span
						ref={refs.setFloating}
						role="listbox"
						id={listboxId}
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
								id={`${listboxId}-option-${index}`}
								type="button"
								role="option"
								aria-selected={option.id === value}
								className={`flex min-w-0 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-surface-raised ${
									index === activeIndex ? "bg-surface-raised" : ""
								}`}
								onMouseDown={(event) => event.preventDefault()}
								onMouseEnter={() => setActiveIndex(index)}
								onClick={() => choose(option)}
							>
								{renderPreview(option)}
								<span className="min-w-0 flex-1">
									<span className="block truncate text-sm font-semibold text-foreground">
										{option.label}
									</span>
									{option.meta === undefined ? null : (
										<span className="mt-0.5 block truncate text-xs text-subtle">
											{option.meta}
										</span>
									)}
								</span>
								{option.id === value ? (
									<span className="icon-[lucide--check] size-4 shrink-0 text-accent" />
								) : null}
							</button>
						))}
					</span>
				</FloatingPortal>
			) : null}
		</label>
	);
};

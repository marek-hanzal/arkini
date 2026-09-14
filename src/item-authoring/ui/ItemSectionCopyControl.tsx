import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, X } from "lucide-react";
import type { ItemSchema } from "~/item-definition/schema/ItemSchema";
import type { SectionId } from "~/item-authoring/type/Section";
import type { copyItemSectionFn } from "~/item-authoring/fn/copyItemSectionFn";
import { readSectionsFn } from "~/item-authoring/fn/readSectionsFn";
import { useFormSession } from "~/item-authoring/ui/FormContext";
import { useEditorItemSearchOptions } from "~/authoring-form/ui/useEditorItemSearchOptions";
import { EditorItemSearchThumbnail } from "~/authoring-form/ui/EditorItemThumbnail";
import { EditorSearchCombobox } from "~/editor-control/ui/EditorSearchCombobox";
import { PrimaryButton } from "~/ui/ui/Button";
import { LinkButton } from "~/ui/ui/LinkButton";
import { useTranslator } from "~/translation/ui/useTranslator";

/** Holds an explicit source snapshot until the user confirms replacement of the active form section. */
export const ItemSectionCopyControl = ({ sectionId }: { readonly sectionId: SectionId }) => {
	const { initialItem, itemId, copySectionFn, isSaving } = useFormSession();
	const translator = useTranslator();
	const [source, setSourceFn] = useState<ItemSchema.Type>();
	const includeItemFn = useCallback(
		(item: ItemSchema.Type) => item.uid !== initialItem.uid && item.id !== itemId,
		[
			initialItem.uid,
			itemId,
		],
	);
	const { items, options } = useEditorItemSearchOptions(includeItemFn);
	const section = readSectionsFn("form").find((candidate) => candidate.id === sectionId);
	if (section === undefined) return null;
	const sectionLabel = translator.textFn(section.label);
	return (
		<>
			<fieldset
				disabled={isSaving}
				inert={isSaving}
				className="w-126 min-w-0 py-0.5"
				data-ui="ItemSectionCopyControl"
			>
				<EditorSearchCombobox
					displaySelectedLabel
					density="compact"
					label="Copy from"
					emptyLabel={translator.textFn("No other item matches this search.")}
					labelVisible={false}
					placeholder={translator.textFn("Copy from…")}
					options={options}
					value={source?.id ?? ""}
					onChangeFn={(id) => {
						const item = items[id ?? ""];
						setSourceFn(
							item === undefined || !includeItemFn(item)
								? undefined
								: structuredClone(item),
						);
					}}
					renderPreviewFn={(option) => (
						<EditorItemSearchThumbnail item={items[option.id]} />
					)}
				/>
			</fieldset>
			{source === undefined
				? null
				: createPortal(
						<div className="fixed inset-0 z-[100] grid place-items-center bg-overlay/95 p-[var(--ak-viewport-padding)]">
							<div
								className="grid w-full max-w-lg gap-4 rounded-2xl border border-line-strong bg-surface-raised p-6 text-foreground shadow-2xl"
								data-ui="ItemSectionCopyDialog"
							>
								<h2 className="text-lg font-semibold">
									{translator.textFn("Replace")} {sectionLabel}?
								</h2>
								<p className="text-sm text-muted">
									{translator.textFn("Copy from")}{" "}
									<strong className="text-foreground">{source.title}</strong>.{" "}
									{translator.textFn(
										"The entire current section will be replaced, including unsaved edits. An empty source section clears it. Nothing is merged. Save applies the change; Discard restores the saved item.",
									)}
								</p>
								{sectionId === "identity" ? (
									<p className="text-sm text-muted">
										{translator.textFn(
											"Item ID, UID and draft status stay unchanged. Clock keeps Board storage and a stack size of one.",
										)}
									</p>
								) : null}
								{sectionId === "production" && source.lines.length > 0 ? (
									<p className="text-sm text-muted">
										{translator.textFn(
											"Copying production also removes the destination action. All lines and queue capacity are replaced.",
										)}
									</p>
								) : null}
								{sectionId === "clock" && source.clock !== undefined ? (
									<p className="text-sm text-muted">
										{translator.textFn(
											"Copying Clock also removes the destination action and sets Board storage with a stack size of one.",
										)}
									</p>
								) : null}
								{sectionId === "action" && source.action !== undefined ? (
									<p className="text-sm text-muted">
										{translator.textFn(
											"Copying an action also removes destination production lines and Clock.",
										)}
									</p>
								) : null}
								<div className="flex items-center justify-between gap-4">
									<LinkButton
										className="inline-flex items-center gap-2 whitespace-nowrap"
										onClick={() => setSourceFn(undefined)}
									>
										<X className="size-4 shrink-0" />
										{translator.textFn("Cancel")}
									</LinkButton>
									<PrimaryButton
										className="gap-2 whitespace-nowrap px-4 py-2"
										disabled={isSaving}
										data-ui="ItemSectionCopyConfirm"
										onClick={() => {
											copySectionFn(
												source,
												sectionId as copyItemSectionFn.Section,
											);
											setSourceFn(undefined);
										}}
									>
										<Copy className="size-4 shrink-0" />
										{translator.textFn("Replace")} {sectionLabel}
									</PrimaryButton>
								</div>
							</div>
						</div>,
						document.body,
					)}
		</>
	);
};

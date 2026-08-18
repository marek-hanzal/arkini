import {
	autoUpdate,
	flip,
	FloatingPortal,
	offset,
	shift,
	useClick,
	useDismiss,
	useFloating,
	useInteractions,
} from "@floating-ui/react";
import { useState } from "react";

import { EditorItemTypes, type EditorItemType } from "~/bridge/item/editor/EditorItemModel";
import { Button, ButtonLink } from "~/ui/button/Button";
import { editorSectionTabClassName } from "~/ui/editor/EditorSectionTabs";
import { EditorItemTypePresentation } from "~/ui/item/editor/EditorItemTypePresentation";

/** Selects a target discriminator before opening the standard explicit-save item form. */
export const EditorItemConvertMenu = ({
	itemType,
	itemUid,
	projectId,
}: {
	readonly itemType: EditorItemType;
	readonly itemUid: string;
	readonly projectId: string;
}) => {
	const [open, setOpen] = useState(false);
	const { context, floatingStyles, refs } = useFloating({
		open,
		onOpenChange: setOpen,
		placement: "bottom-end",
		middleware: [
			offset(6),
			flip(),
			shift({
				padding: 8,
			}),
		],
		whileElementsMounted: autoUpdate,
	});
	const click = useClick(context);
	const dismiss = useDismiss(context);
	const { getFloatingProps, getReferenceProps } = useInteractions([
		click,
		dismiss,
	]);
	return (
		<>
			<Button
				ref={refs.setReference}
				className={`${editorSectionTabClassName} h-10 min-h-10 gap-2`}
				{...getReferenceProps()}
			>
				<span className="icon-[lucide--replace] size-4" />
				Convert
			</Button>
			{open ? (
				<FloatingPortal>
					<div
						ref={refs.setFloating}
						style={floatingStyles}
						className="z-50 grid w-96 max-w-[calc(100vw-1rem)] gap-1 rounded-xl border border-line-strong bg-surface p-1.5 shadow-2xl"
						data-ui="EditorItemConvertMenu"
						{...getFloatingProps()}
					>
						<p className="px-2.5 py-1.5 text-xs text-muted">
							Compatible data is kept; unsupported fields are removed on Save.
						</p>
						{EditorItemTypes.filter((type) => type !== itemType).map((type) => {
							const presentation = EditorItemTypePresentation[type];
							return (
								<ButtonLink
									key={type}
									to="/editor/$projectId/editor/items/$itemUid/form/$sectionId"
									params={{
										projectId,
										itemUid,
										sectionId: "identity",
									}}
									search={{
										itemType: type,
									}}
									className="min-h-0 justify-start gap-3 border-0 bg-transparent px-2.5 py-2 text-left shadow-none"
								>
									<span
										className={`${presentation.icon} size-6 shrink-0 text-accent`}
									/>
									<span className="min-w-0">
										<span className="block font-semibold capitalize">
											{type}
										</span>
										<span className="mt-0.5 block text-xs font-normal leading-4 text-muted">
											{presentation.description}
										</span>
									</span>
								</ButtonLink>
							);
						})}
					</div>
				</FloatingPortal>
			) : null}
		</>
	);
};

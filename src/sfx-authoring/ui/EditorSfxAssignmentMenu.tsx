import { FloatingPortal } from "@floating-ui/react";
import { Check, ListPlus, LoaderCircle } from "lucide-react";

import { useEditorFloatingMenu } from "~/authoring-shell/ui/useEditorFloatingMenu";
import type { GameEventEnumSchema } from "~/game-event/schema/GameEventEnumSchema";
import { SfxEventPresentation } from "~/sfx-authoring/constant/SfxEventPresentation";
import { Tx } from "~/translation/ui/Tx";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { LinkButton } from "~/ui/ui/LinkButton";

interface EditorSfxAssignmentMenuProps {
	readonly resourceIdByEvent: Readonly<Partial<Record<GameEventEnumSchema.Type, string>>>;
	readonly assigningEvent?: GameEventEnumSchema.Type;
	readonly disabled: boolean;
	readonly pending: boolean;
	readonly resourceId: string;
	readonly toggleAssignmentFn: (event: GameEventEnumSchema.Type, resourceId: string) => void;
}

/** Assigns one SFX resource to any number of exact committed gameplay events. */
export const EditorSfxAssignmentMenu = ({
	resourceIdByEvent,
	assigningEvent,
	disabled,
	pending,
	resourceId,
	toggleAssignmentFn,
}: EditorSfxAssignmentMenuProps) => {
	const {
		floatingStyles,
		getFloatingProps: getFloatingPropsFn,
		getReferenceProps: getReferencePropsFn,
		open,
		refs,
		setOpenFn,
	} = useEditorFloatingMenu();

	return (
		<>
			<LinkButton
				ref={refs.setReference}
				className="flex shrink-0 items-center gap-1.5 text-sm"
				cursorIntent={pending ? "progress" : undefined}
				data-ui="EditorSfxAssignTrigger"
				disabled={disabled}
				{...getReferencePropsFn({
					onClick: (event) => event.stopPropagation(),
				})}
			>
				{pending ? (
					<LoaderCircle className="size-4 animate-spin" />
				) : (
					<ListPlus className="size-4" />
				)}
				<Tx label="Assign to" />
			</LinkButton>
			{open ? (
				<FloatingPortal>
					<div
						ref={refs.setFloating}
						className="z-50 grid max-h-96 w-96 max-w-[calc(100vw-1rem)] gap-1 overflow-y-auto overscroll-contain rounded-xl border border-control-border bg-[var(--ak-editor-background)] p-1.5 shadow-2xl"
						data-ui="EditorSfxAssignMenu"
						style={floatingStyles}
						{...getFloatingPropsFn({
							onClick: (event) => event.stopPropagation(),
						})}
					>
						{SfxEventPresentation.map((option) => {
							const selected = resourceIdByEvent[option.event] === resourceId;
							const assigning = pending && assigningEvent === option.event;
							return (
								<button
									className="grid cursor-pointer grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-surface-raised data-[ui-selected=true]:bg-selection data-[ui-selected=true]:text-accent"
									disabled={pending}
									key={option.event}
									onClick={() => {
										toggleAssignmentFn(option.event, resourceId);
										setOpenFn(false);
									}}
									type="button"
									{...readDataUiFn({
										dataUi: "EditorSfxAssignOption",
										state: {
											pending: assigning,
											selected,
										},
									})}
								>
									<span className="min-w-0">
										<span className="block font-semibold">
											<Tx label={option.label} />
										</span>
										<span className="mt-0.5 block text-xs font-normal leading-4 text-muted">
											<Tx label={option.description} />
										</span>
									</span>
									{assigning ? (
										<LoaderCircle className="size-4 animate-spin" />
									) : selected ? (
										<Check className="size-4" />
									) : null}
								</button>
							);
						})}
					</div>
				</FloatingPortal>
			) : null}
		</>
	);
};

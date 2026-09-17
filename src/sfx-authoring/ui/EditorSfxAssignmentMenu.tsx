import { FloatingPortal } from "@floating-ui/react";
import { CircleAlert, CircleCheck, CirclePlus, ListPlus, LoaderCircle } from "lucide-react";

import { useEditorFloatingMenu } from "~/authoring-shell/ui/useEditorFloatingMenu";
import { SfxEventPresentation } from "~/sfx-authoring/constant/SfxEventPresentation";
import type { SfxEventEnumSchema } from "~/sfx-event/schema/SfxEventEnumSchema";
import { Tx } from "~/translation/ui/Tx";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import { LinkButton } from "~/ui/ui/LinkButton";

interface EditorSfxAssignmentMenuProps {
	readonly resourceIdByEvent: Readonly<Partial<Record<SfxEventEnumSchema.Type, string>>>;
	readonly assigningEvent?: SfxEventEnumSchema.Type;
	readonly disabled: boolean;
	readonly pending: boolean;
	readonly resourceId: string;
	readonly toggleAssignmentFn: (event: SfxEventEnumSchema.Type, resourceId: string) => void;
}

/** Assigns one SFX resource to any number of exact Game interactions. */
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
						className="z-50 grid max-h-96 w-[34rem] max-w-[calc(100vw-1rem)] gap-1 overflow-y-auto overscroll-contain rounded-xl border border-control-border bg-[var(--ak-editor-background)] p-1.5 shadow-2xl"
						data-ui="EditorSfxAssignMenu"
						style={floatingStyles}
						{...getFloatingPropsFn({
							onClick: (event) => event.stopPropagation(),
						})}
					>
						{(
							[
								{
									label: "Item",
								},
								{
									label: "Job",
								},
								{
									label: "Other",
								},
							] as const
						).map((group) => (
							<section
								key={group.label}
								data-ui="EditorSfxAssignGroup"
								className="grid gap-1"
							>
								<h3 className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">
									<Tx label={group.label} />
								</h3>
								{SfxEventPresentation.filter(
									(option) => option.group === group.label,
								).map((option) => {
									const assignedResourceId = resourceIdByEvent[option.event];
									const assigned = assignedResourceId !== undefined;
									const selected = assignedResourceId === resourceId;
									const status = selected
										? "current"
										: assigned
											? "assigned"
											: "unassigned";
									const StatusIcon = selected
										? CircleCheck
										: assigned
											? CircleAlert
											: CirclePlus;
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
											) : (
												<span
													className="inline-flex min-w-32 shrink-0 items-center justify-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold data-[ui-status=assigned]:border-warning/45 data-[ui-status=assigned]:bg-warning/10 data-[ui-status=assigned]:text-warning data-[ui-status=current]:border-accent/45 data-[ui-status=current]:bg-accent/10 data-[ui-status=current]:text-accent data-[ui-status=unassigned]:border-info/45 data-[ui-status=unassigned]:bg-info/10 data-[ui-status=unassigned]:text-info"
													{...readDataUiFn({
														dataUi: "EditorSfxAssignOptionStatus",
														state: {
															status,
														},
													})}
												>
													<StatusIcon className="size-4" />
													<Tx
														label={
															selected
																? "Assigned here"
																: assigned
																	? "Assigned"
																	: "Unassigned"
														}
													/>
												</span>
											)}
										</button>
									);
								})}
							</section>
						))}
					</div>
				</FloatingPortal>
			) : null}
		</>
	);
};

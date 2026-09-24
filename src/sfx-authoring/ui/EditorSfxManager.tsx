import { EditorResourceOptimizationLabel } from "~/resource-authoring/ui/EditorResourceOptimizationLabel";
import { match } from "ts-pattern";
import { useState } from "react";
import {
	ChevronRight,
	CircleCheck,
	LoaderCircle,
	Pause,
	Play,
	Sparkles,
	SearchX,
	Trash2,
} from "lucide-react";

import { EditorAudioResourceManager } from "~/audio-authoring/ui/EditorAudioResourceManager";
import { EditorSectionShortcutNavigation } from "~/authoring-shell/ui/EditorSectionBar";
import { EditorFormSectionDivider } from "~/editor-control/ui/EditorFormSectionDivider";
import type { Project } from "~/project-authoring/type/Project";
import { SfxEventPresentation } from "~/sfx-authoring/constant/SfxEventPresentation";
import { useEditorSfxManagerController } from "~/sfx-authoring/ui/useEditorSfxManagerController";
import { useTranslator } from "~/translation/ui/useTranslator";
import { readDataUiFn } from "~/ui/fn/readDataUiFn";
import type { SfxEventEnumSchema } from "~/sfx-event/schema/SfxEventEnumSchema";
import { LinkButton } from "~/ui/ui/LinkButton";
import { Status } from "~/ui/ui/Status";

/** Renders the project SFX library over the shared audio authoring surface. */
export const EditorSfxManager = () => {
	const translator = useTranslator();
	const controller = useEditorSfxManagerController();
	const optimizationPercent =
		controller.optimizationProgress === undefined ||
		controller.optimizationProgress.totalResourceCount === 0
			? 0
			: Math.round(
					(controller.optimizationProgress.completedResourceCount /
						controller.optimizationProgress.totalResourceCount) *
						100,
				);
	const viewOptions = [
		{
			label: translator.textFn("All"),
			value: "all",
			shortcut: "a",
		},
		{
			label: translator.textFn("Assigned"),
			value: "assigned",
			shortcut: "s",
		},
		{
			label: translator.textFn("Unused"),
			value: "unused",
			shortcut: "u",
		},
	] as const satisfies ReadonlyArray<{
		readonly label: string;
		readonly shortcut: string;
		readonly value: useEditorSfxManagerController.View;
	}>;
	const renderResourceActionFn = (resource: Project.Resource) => {
		const assignedEvents = SfxEventPresentation.filter(
			({ event }) => controller.resourceUidByEvent[event] === resource.uid,
		);
		return assignedEvents.length === 0 ? null : (
			<span
				className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-accent"
				data-ui="EditorSfxAssignmentBadge"
				title={assignedEvents.map(({ label }) => translator.textFn(label)).join(", ")}
			>
				<CircleCheck className="size-4" />
				{assignedEvents.length}
			</span>
		);
	};

	return (
		<EditorAudioResourceManager
			controller={controller}
			revealedResource={controller.revealedResource}
			onResourceDragStartFn={
				controller.assignmentPending ||
				controller.optimizePending ||
				controller.importPending
					? undefined
					: (event, resourceUid) => {
							event.dataTransfer.effectAllowed = "copy";
							event.dataTransfer.setData("text/plain", resourceUid);
							controller.setDraggedResourceUidFn(resourceUid);
						}
			}
			onResourceDragEndFn={() => controller.setDraggedResourceUidFn(undefined)}
			sidePanel={<EditorSfxSlots controller={controller} />}
			extraError={controller.assignmentError ?? controller.optimizeError}
			renderResourceActionFn={renderResourceActionFn}
			resourceMutationBlocked={controller.optimizePending}
			resources={controller.sfx}
			secondaryActions={
				<LinkButton
					className="inline-flex min-w-28 shrink-0 items-center justify-end gap-1.5 whitespace-nowrap"
					cursorIntent={controller.optimizePending ? "progress" : undefined}
					data-ui="EditorSfxOptimize"
					disabled={
						controller.optimizePending ||
						controller.importPending ||
						controller.assignmentPending ||
						controller.totalResourceCount === 0
					}
					onClick={controller.onOptimizeFn}
				>
					<Sparkles className="size-4" />
					<EditorResourceOptimizationLabel
						pending={controller.optimizePending}
						phase={controller.optimizationProgress?.phase}
						percent={optimizationPercent}
					/>
				</LinkButton>
			}
			secondaryNavigation={
				<EditorSectionShortcutNavigation
					dataUi="EditorSfxView"
					onChangeFn={controller.setViewFn}
					options={viewOptions}
					value={controller.view}
				/>
			}
		/>
	);
};

/** Slots remain visible independently of library search and usage filters. */
const EditorSfxSlots = ({
	controller,
}: {
	readonly controller: useEditorSfxManagerController.Output;
}) => {
	const translator = useTranslator();
	const [hoveredEvent, setHoveredEventFn] = useState<SfxEventEnumSchema.Type>();
	const blocked =
		controller.assignmentPending || controller.optimizePending || controller.importPending;
	const canDrop = !blocked && controller.draggedResourceUid !== undefined;
	const visibleSlots = SfxEventPresentation.filter((option) => {
		const assigned = controller.resourceUidByEvent[option.event] !== undefined;
		return match(controller.view)
			.with("all", () => true)
			.with("assigned", () => assigned)
			.with("unused", () => !assigned)
			.exhaustive();
	});
	if (visibleSlots.length === 0)
		return (
			<Status
				dataUi="EditorSfxSlotsEmpty"
				icon={SearchX}
				size="large"
				variant="flat"
				title={translator.textFn(
					controller.view === "assigned" ? "No assigned slots" : "No unassigned slots",
				)}
				description={translator.textFn(
					controller.view === "assigned"
						? "No slots have a sound assigned. Switch to All and drag a sound onto a slot."
						: "Every slot has a sound assigned. Switch to All to see them.",
				)}
			/>
		);
	return (
		<div
			className="grid gap-6"
			data-ui="EditorSfxSlots"
		>
			{(
				[
					"Item",
					"Job",
					"Other",
				] as const
			)
				.filter((group) => visibleSlots.some((option) => option.group === group))
				.map((group) => (
					<section
						className="grid gap-3"
						key={group}
					>
						<EditorFormSectionDivider title={translator.textFn(group)} />
						<div className="ak-list grid gap-2">
							{visibleSlots
								.filter((option) => option.group === group)
								.map((option) => {
									const resourceUid = controller.resourceUidByEvent[option.event];
									const resource = controller.allSfx.find(
										({ uid }) => uid === resourceUid,
									);
									const playing =
										resourceUid !== undefined &&
										controller.activeResourceUid === resourceUid &&
										controller.playing;
									const pending =
										controller.assignmentPending &&
										controller.assigningEvent === option.event;
									return (
										<div
											key={option.event}
											className="ak-list-row grid min-w-0 grid-cols-[minmax(0,1fr)_5.5rem] items-center gap-3 px-4 py-3 data-[ui-drop-target=true]:outline-2 data-[ui-drop-target=true]:-outline-offset-2 data-[ui-drop-target=true]:outline-accent"
											{...readDataUiFn({
												dataUi: "EditorSfxSlot",
												state: {
													assigned: resourceUid !== undefined,
													dropTarget:
														canDrop && hoveredEvent === option.event,
												},
											})}
											data-event={option.event}
											onDragOver={(event) => {
												if (!canDrop) return;
												event.preventDefault();
												event.dataTransfer.dropEffect = "copy";
												setHoveredEventFn(option.event);
											}}
											onDragLeave={(event) => {
												if (
													!(event.relatedTarget instanceof Node) ||
													!event.currentTarget.contains(
														event.relatedTarget,
													)
												)
													setHoveredEventFn(undefined);
											}}
											onDrop={(event) => {
												event.preventDefault();
												setHoveredEventFn(undefined);
												if (canDrop)
													controller.assignResourceFn(
														option.event,
														controller.draggedResourceUid,
													);
												controller.setDraggedResourceUidFn(undefined);
											}}
										>
											<div className="min-w-0">
												<p className="font-semibold">
													{translator.textFn(option.label)}
												</p>
												<p className="mt-0.5 text-xs text-muted">
													{translator.textFn(option.description)}
												</p>
												{resourceUid === undefined ? (
													<p className="mt-2 h-5 text-sm leading-5 text-muted">
														{translator.textFn("Unassigned")}
													</p>
												) : (
													<LinkButton
														className="mt-2 flex h-5 w-fit max-w-full items-center gap-1 text-sm leading-5"
														data-ui="EditorSfxReveal"
														onClick={() =>
															controller.revealResourceFn(resourceUid)
														}
													>
														<span className="truncate">
															{resource?.title ?? resourceUid}
														</span>
														<ChevronRight className="size-4 shrink-0" />
													</LinkButton>
												)}
											</div>
											<div className="flex items-center justify-end gap-2">
												{pending ? (
													<LoaderCircle className="size-4 animate-spin text-accent" />
												) : null}
												{resourceUid === undefined ? null : (
													<>
														<LinkButton
															className="grid size-9 shrink-0 place-items-center text-foreground"
															data-ui="EditorSfxSlotPlayback"
															onClick={() =>
																controller.togglePlaybackFn(
																	resourceUid,
																)
															}
														>
															{playing ? (
																<Pause className="size-4" />
															) : (
																<Play className="size-4" />
															)}
														</LinkButton>
														<LinkButton
															disabled={blocked}
															data-ui="EditorSfxUnassign"
															title={translator.textFn("Remove")}
															onClick={() =>
																controller.assignResourceFn(
																	option.event,
																	undefined,
																)
															}
														>
															<Trash2 className="size-4" />
														</LinkButton>
													</>
												)}
											</div>
										</div>
									);
								})}
						</div>
					</section>
				))}
		</div>
	);
};

import {
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
	type DragStartEvent,
} from "@dnd-kit/core";
import { useMachine } from "@xstate/react";
import type { DraggablePayload } from "~/drag/DraggablePayload";
import type { DropContext } from "~/drag/DropContext";
import type { DropPlan } from "~/drag/DropPlan";
import type { DroppablePayload } from "~/drag/DroppablePayload";
import type { MagneticDropContext } from "~/drag/MagneticDropContext";
import type { ResolvedDraggableAnimation } from "~/drag/ResolvedDraggableAnimation";
import type { DropPlanRuntime } from "~/drag/DropPlanRuntime";
import { draggableWorkflowMachine } from "~/drag/logic/draggableWorkflowMachine";
import { failDrop } from "~/drag/logic/failDrop";
import { resolveDropContext } from "~/drag/logic/resolveDropContext";
import { runDropPlan } from "~/drag/logic/runDropPlan";
import { useDragBoundaryModifier } from "./useDragBoundaryModifier";
import { useDragSession } from "./useDragSession";
import { useHiddenSources } from "./useHiddenSources";

export namespace useDraggableControl {
	export interface Props<
		ItemId extends string = string,
		Source = unknown,
		Target = unknown,
		Overlay = unknown,
		Kind extends string = string,
	> {
		resolveDrop(
			context: DropContext<ItemId, Source, Target, Overlay>,
		): DropPlan<ItemId, Kind, Overlay> | Promise<DropPlan<ItemId, Kind, Overlay>>;
		animate(animation: ResolvedDraggableAnimation<ItemId, Kind, Overlay>): Promise<void> | void;
		schedule?(operation: () => Promise<void>): Promise<void>;
		onError?(
			error: unknown,
			context: DropContext<ItemId, Source, Target, Overlay>,
		): void | Promise<void>;
		/**
		 * Optional semantic target resolver. When present, its result wins over dnd-kit `over`,
		 * so apps can implement magnetic edge/corner snapping consistently across surfaces.
		 */
		resolveMagneticDropTarget?(
			context: MagneticDropContext<ItemId, Source, Overlay>,
		): DroppablePayload<Target> | null;
		getDragBoundaryNodeId?(
			source: DraggablePayload<ItemId, Source, Overlay>,
		): string | null | undefined;
		activationDistance?: number;
	}
}

/**
 * Generic drag/drop workflow.
 *
 * This hook deliberately knows nothing about domain rules, surfaces, or
 * persistence. It wires dnd-kit to the XState workflow and delegates source
 * hiding, animations, target resolving, and plan execution to small drag modules.
 */
export const useDraggableControl = <
	ItemId extends string = string,
	Source = unknown,
	Target = unknown,
	Overlay = unknown,
	Kind extends string = string,
>({
	resolveDrop,
	animate,
	onError,
	schedule,
	resolveMagneticDropTarget,
	getDragBoundaryNodeId,
	activationDistance = 5,
}: useDraggableControl.Props<ItemId, Source, Target, Overlay, Kind>) => {
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: activationDistance,
			},
		}),
	);
	const [workflow, sendWorkflow] = useMachine(draggableWorkflowMachine);
	const session = useDragSession<ItemId, Source, Overlay>({
		getDragBoundaryNodeId,
	});
	const sources = useHiddenSources();
	const modifiers = useDragBoundaryModifier({
		boundaryRectRef: session.dragBoundaryRectRef,
		enabled: Boolean(getDragBoundaryNodeId),
	});
	const runtime: DropPlanRuntime<ItemId, Source, Target, Overlay, Kind> = {
		animate,
		onError,
		sendWorkflow,
		hideSources: sources.hideSources,
		clearHiddenSources: sources.clearHiddenSources,
		clearActiveDrag: session.clear,
	};

	const handleDragEnd = async (event: DragEndEvent) => {
		const { context, dragRect } = resolveDropContext<ItemId, Source, Target, Overlay>({
			event,
			resolveMagneticDropTarget,
		});
		session.clearPreview();

		if (!context) {
			sendWorkflow({
				type: "RESET",
			});
			session.clear();
			return;
		}

		sendWorkflow({
			type: "DROP_RESOLVING",
		});
		const operation = async () => {
			try {
				await runDropPlan({
					context,
					plan: await resolveDrop(context),
					dragRect,
					runtime,
				});
			} catch (error) {
				await failDrop({
					error,
					context,
					dragRect,
					runtime,
				});
			}
		};

		if (schedule) await schedule(operation);
		else await operation();
	};

	const isSourceHidden = (sourceId: string) =>
		sources.hiddenSourceIds.has(sourceId) ||
		(session.activeDrag?.hideWhenActive !== false && session.activeDrag?.sourceId === sourceId);

	return {
		contextProps: {
			sensors,
			onDragStart: (event: DragStartEvent) => {
				sendWorkflow({
					type: "DRAG_STARTED",
				});
				sources.clearHiddenSources();
				session.start(event);
			},
			onDragEnd: handleDragEnd,
			onDragCancel: () => {
				sendWorkflow({
					type: "DRAG_CANCELLED",
				});
				session.clear();
				sources.clearHiddenSources();
			},
			modifiers,
		},
		activeDrag: session.activeDrag,
		hiddenSourceIds: sources.hiddenSourceIds,
		dragPreviewRect: session.dragPreviewRect,
		workflowState: workflow.value,
		isSourceHidden,
		hideSources: sources.hideSources,
		showSource: sources.showSource,
		clearHiddenSources: sources.clearHiddenSources,
	};
};

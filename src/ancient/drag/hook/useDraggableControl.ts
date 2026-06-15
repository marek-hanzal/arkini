import { useCallback, useMemo, useState } from "react";
import type { DraggablePayload } from "~/drag/DraggablePayload";
import type { DropContext } from "~/drag/DropContext";
import type { DropOutcome } from "~/drag/DropOutcome";
import type { DropPlan } from "~/drag/DropPlan";
import type { DroppablePayload } from "~/drag/DroppablePayload";
import type { ResolvedDraggableAnimation } from "~/drag/ResolvedDraggableAnimation";
import type { DropPlanRuntime } from "~/drag/DropPlanRuntime";
import { failDrop } from "~/drag/logic/failDrop";
import { runDropPlan } from "~/drag/logic/runDropPlan";
import type { RectLike } from "~/play/types";
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
		schedule?<T>(operation: () => Promise<T>): Promise<T>;
		onError?(
			error: unknown,
			context: DropContext<ItemId, Source, Target, Overlay>,
		): void | Promise<void>;
	}

	export interface StartProps<ItemId extends string, Source, Overlay> {
		source: DraggablePayload<ItemId, Source, Overlay>;
		previewRect: Pick<RectLike, "width" | "height">;
	}

	export interface DropProps<ItemId extends string, Source, Target, Overlay> {
		source: DraggablePayload<ItemId, Source, Overlay>;
		target: DroppablePayload<Target> | null;
		dragRect: RectLike | null;
	}
}

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
}: useDraggableControl.Props<ItemId, Source, Target, Overlay, Kind>) => {
	const sources = useHiddenSources();
	const [activeDrag, setActiveDrag] = useState<DraggablePayload<ItemId, Source, Overlay> | null>(
		null,
	);
	const [dragPreviewRect, setDragPreviewRect] = useState<Pick<
		RectLike,
		"width" | "height"
	> | null>(null);
	const [activeDropTargetNodeId, setActiveDropTargetNodeId] = useState<string | null>(null);

	const clearActiveDrag = useCallback(() => {
		setActiveDrag(null);
		setDragPreviewRect(null);
		setActiveDropTargetNodeId(null);
	}, []);
	const runtime: DropPlanRuntime<ItemId, Source, Target, Overlay, Kind> = useMemo(
		() => ({
			animate,
			onError,
			hideSources: sources.hideSources,
			clearHiddenSources: sources.clearHiddenSources,
			clearActiveDrag,
		}),
		[
			animate,
			clearActiveDrag,
			onError,
			sources.clearHiddenSources,
			sources.hideSources,
		],
	);

	const start = useCallback(
		({ source, previewRect }: useDraggableControl.StartProps<ItemId, Source, Overlay>) => {
			sources.clearHiddenSources();
			setActiveDrag(source);
			setDragPreviewRect(previewRect);
		},
		[
			sources.clearHiddenSources,
		],
	);

	const cancel = useCallback(() => {
		clearActiveDrag();
		sources.clearHiddenSources();
	}, [
		clearActiveDrag,
		sources.clearHiddenSources,
	]);

	const drop = useCallback(
		async ({
			source,
			target,
			dragRect,
		}: useDraggableControl.DropProps<
			ItemId,
			Source,
			Target,
			Overlay
		>): Promise<DropOutcome> => {
			const context: DropContext<ItemId, Source, Target, Overlay> = {
				source,
				target,
			};

			const operation = async () => {
				try {
					return await runDropPlan({
						context,
						plan: await resolveDrop(context),
						dragRect,
						runtime,
					});
				} catch (error) {
					return await failDrop({
						error,
						context,
						dragRect,
						runtime,
					});
				}
			};

			return schedule ? await schedule(operation) : await operation();
		},
		[
			resolveDrop,
			runtime,
			schedule,
		],
	);

	const isSourceHidden = useCallback(
		(sourceId: string) => sources.hiddenSourceIds.has(sourceId),
		[
			sources.hiddenSourceIds,
		],
	);

	return useMemo(
		() => ({
			activeDrag,
			activeDropTargetNodeId,
			hiddenSourceIds: sources.hiddenSourceIds,
			dragPreviewRect,
			isSourceHidden,
			hideSources: sources.hideSources,
			showSource: sources.showSource,
			clearHiddenSources: sources.clearHiddenSources,
			clearActiveDrag,
			setActiveDropTargetNodeId,
			start,
			drop,
			cancel,
		}),
		[
			activeDrag,
			activeDropTargetNodeId,
			cancel,
			clearActiveDrag,
			dragPreviewRect,
			drop,
			isSourceHidden,
			start,
			sources.clearHiddenSources,
			sources.hiddenSourceIds,
			sources.hideSources,
			sources.showSource,
		],
	);
};

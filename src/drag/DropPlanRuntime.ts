import type { DropContext } from "~/drag/DropContext";
import type { ResolvedDraggableAnimation } from "~/drag/ResolvedDraggableAnimation";

export interface DropPlanRuntime<
	ItemId extends string,
	Source,
	Target,
	Overlay,
	Kind extends string,
> {
	animate(animation: ResolvedDraggableAnimation<ItemId, Kind, Overlay>): Promise<void> | void;
	onError?(
		error: unknown,
		context: DropContext<ItemId, Source, Target, Overlay>,
	): void | Promise<void>;
	hideSources(ids: readonly string[]): void;
	clearHiddenSources(): void;
	clearActiveDrag(): void;
}

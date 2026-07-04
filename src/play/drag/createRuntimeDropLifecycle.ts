import type { GameAudioPlayer } from "~/audio/GameAudioPlayer";
import type { DragSource } from "~/play/drag/DragSource";
import type { DropTarget } from "~/play/drag/DropTarget";
import { playDropSettledAudio } from "~/play/drag/playDropSettledAudio";
import type { DropActions } from "~/play/drop/DropActions";
import { resolveDrop } from "~/play/drop/resolveDrop";
import type { Feedback } from "~/play/feedback/Feedback";
import type { GameRuntimeStore } from "~/play/runtime/GameRuntimeStore";
import { readBoardView } from "~/play/runtime/readers/readBoardView";
import { readInventoryView } from "~/play/runtime/readers/readInventoryView";
import type { TileEngine } from "~/tile-engine/TileEngine.types";

export namespace createRuntimeDropLifecycle {
	export interface Props {
		actions: DropActions;
		audio: Pick<GameAudioPlayer, "play">;
		feedback: Feedback.Type;
		runtimeStore: GameRuntimeStore;
	}
}

export const createRuntimeDropLifecycle = <TTile, TSlot>({
	actions,
	audio,
	feedback,
	runtimeStore,
}: createRuntimeDropLifecycle.Props) => ({
	onDragStart() {
		audio.play("audio.tile.drag.start");
	},
	onDrop(context: TileEngine.DropContext<TTile, TSlot, DragSource, DropTarget>) {
		const snapshot = runtimeStore.getSnapshot();
		const nowMs = Date.now();

		return resolveDrop({
			context,
			board: readBoardView(snapshot, nowMs),
			config: snapshot.runtime.config,
			inventory: readInventoryView(snapshot),
			feedback,
			actions,
		});
	},
	onDropSettled({ kind }: { kind: "accept" | "ignore" | "reject" }) {
		playDropSettledAudio({
			audio,
			kind,
		});
	},
});

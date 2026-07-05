import type { TileVisualSnapshot } from "~/tile-engine/TileVisualSnapshot";

export namespace TileMotionRuntime {
	export type Status = "completed" | "cancelled";
	export type StyleKeyframes = Record<string, unknown>;

	export interface Result {
		readonly status: Status;
		readonly snapshot: TileVisualSnapshot.Type;
	}

	export interface StartStyleProps {
		readonly scope: string;
		readonly element: HTMLElement;
		readonly keyframes:
			| StyleKeyframes
			| ((snapshot: TileVisualSnapshot.Type) => StyleKeyframes);
		readonly delay?: number;
		readonly duration: number;
		readonly ease: readonly number[];
	}

	export interface StartTransformProps {
		readonly scope: string;
		readonly element: HTMLElement;
		readonly from: string | ((snapshot: TileVisualSnapshot.Type) => string);
		readonly to: string | ((snapshot: TileVisualSnapshot.Type) => string);
		readonly duration: number;
		readonly ease: readonly number[];
	}

	export interface MotionControl {
		readonly finished: Promise<unknown>;
		cancel(): void;
		commitStyles?(): void;
	}

	export interface ActiveMotion {
		readonly id: string;
		readonly scope: string;
		readonly element: HTMLElement;
		readonly control: MotionControl;
		resolve(result: Result): void;
	}
}

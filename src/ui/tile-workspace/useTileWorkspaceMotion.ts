import { useEffect, useRef } from "react";
import { match } from "ts-pattern";

import type { TileWorkspacePhase } from "~/ui/tile-workspace/TileWorkspaceControl";
import { useTileWorkspaceControl } from "~/ui/tile-workspace/useTileWorkspaceControl";

const visibleDialog = {
	opacity: 1,
	y: 0,
};

const exitingDialog = {
	opacity: 0,
	y: 8,
};

/** Owns one generation-safe local modal motion completion. */
export const useTileWorkspaceMotion = ({
	phase,
	generation,
}: {
	readonly phase: Exclude<TileWorkspacePhase, "closed">;
	readonly generation: number;
}) => {
	const workspace = useTileWorkspaceControl();
	const completedPhaseRef = useRef<TileWorkspacePhase | null>(null);

	useEffect(() => {
		completedPhaseRef.current = null;
	}, [
		phase,
	]);

	const completeMotionPhase = () => {
		if (completedPhaseRef.current === phase) return;
		match(phase)
			.with("entering", () => {
				completedPhaseRef.current = phase;
				workspace.completeEnter(generation);
			})
			.with("open", () => undefined)
			.with("exiting", () => {
				completedPhaseRef.current = phase;
				workspace.completeExit(generation);
			})
			.exhaustive();
	};

	const visual = match(phase)
		.with("entering", "open", () => ({
			backdropOpacity: 1,
			dialog: visibleDialog,
		}))
		.with("exiting", () => ({
			backdropOpacity: 0,
			dialog: exitingDialog,
		}))
		.exhaustive();

	return {
		...visual,
		completeMotionPhase,
	};
};

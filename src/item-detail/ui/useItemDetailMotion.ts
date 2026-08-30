import { useCallback, useEffect, useRef } from "react";
import { match } from "ts-pattern";

import { RendererRuntime } from "~/application-runtime/service/RendererRuntime";
import type { ItemDetailState } from "~/item-detail-frame/type/ItemDetailControl";
import { useItemDetailControl } from "~/item-detail-frame/ui/useItemDetailControl";

const visibleDialog = {
	opacity: 1,
	y: 0,
};

const exitingDialog = {
	opacity: 0,
	y: 8,
};

export const itemDetailTransition = {
	duration: 0.22,
	ease: [
		0.22,
		1,
		0.36,
		1,
	] as const,
};

export namespace useItemDetailMotion {
	export interface Props {
		readonly state: Exclude<
			ItemDetailState,
			{
				readonly phase: "closed";
			}
		>;
	}

	export interface Output {
		readonly backdropOpacity: number;
		readonly completeMotionPhase: () => void;
		readonly dialog: typeof visibleDialog | typeof exitingDialog;
	}
}

/** Settles only the enter/exit generation whose animation just completed. */
export const useItemDetailMotion = ({
	state,
}: useItemDetailMotion.Props): useItemDetailMotion.Output => {
	const itemDetail = useItemDetailControl();
	const completedPhaseRef = useRef<ItemDetailState["phase"] | null>(null);

	useEffect(() => {
		completedPhaseRef.current = null;
	}, [
		state.phase,
		state.generation,
	]);

	const completeMotionPhase = useCallback(() => {
		if (completedPhaseRef.current === state.phase) return;
		match(state)
			.with(
				{
					phase: "entering",
				},
				({ generation }) => {
					completedPhaseRef.current = state.phase;
					RendererRuntime.runSync(itemDetail.completeEnterFx(generation));
				},
			)
			.with(
				{
					phase: "open",
				},
				() => undefined,
			)
			.with(
				{
					phase: "exiting",
				},
				({ generation }) => {
					completedPhaseRef.current = state.phase;
					RendererRuntime.runSync(itemDetail.completeExitFx(generation));
				},
			)
			.exhaustive();
	}, [
		itemDetail,
		state,
	]);

	const visual = match(state)
		.with(
			{
				phase: "entering",
			},
			{
				phase: "open",
			},
			() => ({
				backdropOpacity: 1,
				dialog: visibleDialog,
			}),
		)
		.with(
			{
				phase: "exiting",
			},
			() => ({
				backdropOpacity: 0,
				dialog: exitingDialog,
			}),
		)
		.exhaustive();

	return {
		backdropOpacity: visual.backdropOpacity,
		completeMotionPhase,
		dialog: visual.dialog,
	};
};

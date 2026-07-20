import { useEffect, useRef } from "react";
import { match } from "ts-pattern";

import type { ItemDetailState } from "~/ui/item-detail/ItemDetailControl";
import { useItemDetailControl } from "~/ui/item-detail/useItemDetailControl";

const visibleDialog = {
	opacity: 1,
	y: 0,
};

const exitingDialog = {
	opacity: 0,
	y: 8,
};

/** Owns one generation-safe local Item Detail motion completion. */
export const useItemDetailMotion = ({
	state,
}: {
	readonly state: Exclude<
		ItemDetailState,
		{
			readonly phase: "closed";
		}
	>;
}) => {
	const itemDetail = useItemDetailControl();
	const completedPhaseRef = useRef<ItemDetailState["phase"] | null>(null);

	useEffect(() => {
		completedPhaseRef.current = null;
	}, [
		state.phase,
		state.generation,
	]);

	const completeMotionPhase = () => {
		if (completedPhaseRef.current === state.phase) return;
		match(state)
			.with(
				{
					phase: "entering",
				},
				({ generation }) => {
					completedPhaseRef.current = state.phase;
					itemDetail.completeEnter(generation);
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
					itemDetail.completeExit(generation);
				},
			)
			.exhaustive();
	};

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
		...visual,
		completeMotionPhase,
	};
};

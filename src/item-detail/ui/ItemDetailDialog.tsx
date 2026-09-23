import { motion } from "motion/react";

import { useCloseItemDetail } from "~/item-detail-frame/ui/useCloseItemDetail";
import { ItemDetailScene } from "~/item-detail/ui/ItemDetailScene";
import { useItemDetailFocus } from "~/item-detail/ui/useItemDetailFocus";
import { itemDetailTransition, useItemDetailMotion } from "~/item-detail/ui/useItemDetailMotion";

export const ItemDetailDialog = ({ state }: useItemDetailMotion.Props) => {
	const closeItemDetailFn = useCloseItemDetail();
	const motionState = useItemDetailMotion({
		state,
	});
	const focus = useItemDetailFocus({
		phase: state.phase,
		origin: state.target.origin,
		restoreFocus: state.phase === "exiting" ? state.restoreFocus : true,
		focusKey: `${state.target.kind}:${state.target.kind === "runtime" ? state.target.itemId : state.target.itemUid}`,
	});
	const disabled = state.phase === "exiting";
	return (
		<motion.div
			className="absolute inset-0 z-[70] grid cursor-default place-items-center overflow-hidden bg-overlay/70 p-[var(--ak-viewport-padding)] text-overlay-foreground"
			data-ui="ItemDetailBackdrop"
			data-phase={state.phase}
			initial={{
				opacity: 0,
			}}
			animate={{
				opacity: motionState.backdropOpacity,
			}}
			transition={itemDetailTransition}
			onPointerDown={(event) => {
				if (event.target !== event.currentTarget || state.phase === "exiting") return;
				closeItemDetailFn();
			}}
		>
			<motion.div
				ref={focus.overlayRef}
				className="flex h-[90%] max-h-full w-[90%] max-w-full cursor-default flex-col overflow-hidden rounded-2xl border border-line-strong bg-modal p-[var(--ak-panel-padding)] text-foreground shadow-[0_2rem_5rem_color-mix(in_srgb,var(--ak-overlay)_58%,transparent),0_0_0_1px_color-mix(in_srgb,var(--ak-line-strong)_45%,transparent)]"
				data-ui="ItemDetailModal"
				onContextMenu={(event) => {
					event.preventDefault();
					event.stopPropagation();
					if (!disabled) closeItemDetailFn();
				}}
				data-target-kind={state.target.kind}
				data-runtime-id={state.target.kind === "runtime" ? state.target.itemId : undefined}
				data-item-uid={
					state.target.kind === "definition" ? state.target.itemUid : undefined
				}
				initial={{
					opacity: 0,
					y: 10,
				}}
				animate={motionState.dialog}
				transition={itemDetailTransition}
				onAnimationComplete={motionState.completeMotionPhaseFn}
			>
				<ItemDetailScene
					disabled={disabled}
					target={state.target}
				/>
			</motion.div>
		</motion.div>
	);
};

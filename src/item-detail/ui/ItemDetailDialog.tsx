import { motion } from "motion/react";
import { match } from "ts-pattern";

import { useCloseItemDetail } from "~/item-detail-frame/ui/useCloseItemDetail";
import { DefinitionItemDetailScene } from "~/item-detail/ui/DefinitionItemDetailScene";
import { RuntimeItemDetailScene } from "~/item-detail/ui/RuntimeItemDetailScene";
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
		focusKey: `${state.target.kind}:${state.target.itemId}:${state.target.tab}`,
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
				className="flex h-[90vh] max-h-full w-[90vw] max-w-full cursor-default flex-col overflow-hidden rounded-2xl border border-line-strong bg-surface-raised p-[var(--ak-panel-padding)] text-foreground shadow-[0_2rem_5rem_color-mix(in_srgb,var(--ak-overlay)_58%,transparent),0_0_0_1px_color-mix(in_srgb,var(--ak-line-strong)_45%,transparent)]"
				data-ui="ItemDetailModal"
				data-tab={state.target.tab}
				data-target-kind={state.target.kind}
				data-runtime-id={state.target.kind === "runtime" ? state.target.itemId : undefined}
				data-item-id={state.target.itemId}
				initial={{
					opacity: 0,
					y: 10,
				}}
				animate={motionState.dialog}
				transition={itemDetailTransition}
				onAnimationComplete={motionState.completeMotionPhaseFn}
			>
				{match(state.target)
					.with(
						{
							kind: "runtime",
						},
						(target) => (
							<RuntimeItemDetailScene
								disabled={disabled}
								target={target}
							/>
						),
					)
					.with(
						{
							kind: "definition",
						},
						(target) => (
							<DefinitionItemDetailScene
								disabled={disabled}
								target={target}
							/>
						),
					)
					.exhaustive()}
			</motion.div>
		</motion.div>
	);
};

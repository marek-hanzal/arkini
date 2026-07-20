import { motion } from "motion/react";
import { useEffect } from "react";
import { match, P } from "ts-pattern";

import { useTileInfo } from "~/bridge/tile/useTileInfo";
import { TileInfoWorkspace } from "~/ui/tile-workspace/TileInfoWorkspace";
import type {
	TileWorkspacePhase,
	TileWorkspaceTarget,
} from "~/ui/tile-workspace/TileWorkspaceControl";
import { useTileWorkspaceControl } from "~/ui/tile-workspace/useTileWorkspaceControl";
import { useTileWorkspaceFocus } from "~/ui/tile-workspace/useTileWorkspaceFocus";
import { useTileWorkspaceMotion } from "~/ui/tile-workspace/useTileWorkspaceMotion";

const transition = {
	duration: 0.22,
	ease: [
		0.22,
		1,
		0.36,
		1,
	] as const,
};

const TileWorkspaceDialog = ({
	phase,
	target,
}: {
	readonly phase: Exclude<TileWorkspacePhase, "closed">;
	readonly target: TileWorkspaceTarget;
}) => {
	const workspace = useTileWorkspaceControl();
	const info = useTileInfo(target.itemId);
	const motionState = useTileWorkspaceMotion({
		phase,
		generation: target.generation,
	});
	const focus = useTileWorkspaceFocus({
		phase,
		origin: target.origin,
	});

	useEffect(() => {
		if (info.kind === "available") return;
		void workspace.close();
	}, [
		info.kind,
		workspace,
	]);

	const title = info.kind === "available" ? info.title : "Unavailable";
	const subtitle = info.kind === "available" ? info.subtitle : undefined;

	return (
		<motion.div
			className="absolute inset-0 z-[70] grid place-items-center overflow-hidden bg-overlay/70 p-[var(--ak-viewport-padding)] text-overlay-foreground"
			data-ui="TileWorkspaceBackdrop"
			data-phase={phase}
			initial={{
				opacity: 0,
			}}
			animate={{
				opacity: motionState.backdropOpacity,
			}}
			transition={transition}
			onPointerDown={(event) => {
				if (event.target !== event.currentTarget || phase === "exiting") return;
				void workspace.close();
			}}
		>
			<motion.div
				ref={focus.dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby="tile-workspace-title"
				className="flex h-[min(46rem,100%)] max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line-strong bg-surface-raised p-[var(--ak-panel-padding)] text-foreground shadow-[0_2rem_5rem_color-mix(in_srgb,var(--ak-overlay)_58%,transparent),0_0_0_1px_color-mix(in_srgb,var(--ak-line-strong)_45%,transparent)] outline-none"
				data-ui="TileWorkspaceModal"
				data-capability={target.capability}
				data-runtime-id={target.itemId}
				tabIndex={-1}
				initial={{
					opacity: 0,
					y: 10,
				}}
				animate={motionState.dialog}
				transition={transition}
				onAnimationComplete={motionState.completeMotionPhase}
				onKeyDown={focus.keepFocusInside}
			>
				<header className="mb-[var(--ak-panel-padding)] flex min-w-0 items-start justify-between gap-4 border-b border-line pb-4">
					<div className="min-w-0">
						<h2
							id="tile-workspace-title"
							className="truncate text-xl font-semibold"
						>
							{title}
							{subtitle === undefined ? null : (
								<span className="font-normal text-muted"> · {subtitle}</span>
							)}
						</h2>
					</div>
					<button
						type="button"
						className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface text-lg leading-none text-muted transition-colors hover:bg-accent/15 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
						aria-label="Close Info"
						disabled={phase === "exiting"}
						onClick={() => void workspace.close()}
					>
						×
					</button>
				</header>
				{info.kind === "available" ? (
					<TileInfoWorkspace info={info} />
				) : (
					<div className="grid flex-1 place-items-center text-muted">
						Item is no longer available.
					</div>
				)}
			</motion.div>
		</motion.div>
	);
};

/** Renders the one active tile capability workspace over the unchanged tile scene. */
export const TileWorkspace = () => {
	const workspace = useTileWorkspaceControl();
	return match({
		phase: workspace.phase,
		target: workspace.target,
	})
		.with(
			{
				phase: "closed",
			},
			() => null,
		)
		.with(
			{
				phase: "entering",
				target: {
					generation: P.number,
				},
			},
			{
				phase: "open",
				target: {
					generation: P.number,
				},
			},
			{
				phase: "exiting",
				target: {
					generation: P.number,
				},
			},
			({ phase, target }) => (
				<TileWorkspaceDialog
					phase={phase}
					target={target}
				/>
			),
		)
		.otherwise(() => null);
};

import { motion } from "motion/react";
import { type ReactNode, useEffect } from "react";
import { match, P } from "ts-pattern";

import { useTileIdentity } from "~/bridge/tile/useTileIdentity";
import { useTileInfo } from "~/bridge/tile/useTileInfo";
import { useTileEffects } from "~/bridge/tile/useTileEffects";
import { useTileLines } from "~/bridge/tile/useTileLines";
import { useTileStatus } from "~/bridge/tile/useTileStatus";
import { TileEffectsWorkspace } from "~/ui/tile-workspace/TileEffectsWorkspace";
import { TileInfoWorkspace } from "~/ui/tile-workspace/TileInfoWorkspace";
import { TileLinesWorkspace } from "~/ui/tile-workspace/TileLinesWorkspace";
import {
	readTileStatusPresentation,
	TileStatusWorkspace,
} from "~/ui/tile-workspace/TileStatusWorkspace";
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

const TileWorkspaceHeaderArtwork = ({
	identity,
}: {
	readonly identity: Extract<
		useTileIdentity.Projection,
		{
			readonly kind: "available";
		}
	>;
}) => (
	<div
		className="relative size-16 shrink-0"
		data-ui="TileWorkspaceHeaderArtwork"
	>
		<img
			className="absolute inset-0 size-full object-contain drop-shadow-[0_0.45rem_0.65rem_color-mix(in_srgb,var(--ak-overlay)_35%,transparent)]"
			src={identity.sourceUrl}
			alt=""
			draggable={false}
		/>
		{identity.compositeUrl === undefined ? null : (
			<img
				className="absolute inset-0 size-full object-contain drop-shadow-[0_0.45rem_0.65rem_color-mix(in_srgb,var(--ak-overlay)_35%,transparent)]"
				src={identity.compositeUrl}
				alt=""
				draggable={false}
			/>
		)}
	</div>
);

const TileWorkspaceChrome = ({
	children,
	closeLabel,
	contextLabel,
	disabled,
	identity,
}: {
	readonly children: ReactNode;
	readonly closeLabel: string;
	readonly contextLabel?: string;
	readonly disabled: boolean;
	readonly identity: Extract<
		useTileIdentity.Projection,
		{
			readonly kind: "available";
		}
	>;
}) => {
	const workspace = useTileWorkspaceControl();
	const meta = [
		identity.subtitle,
		contextLabel,
	].filter((value): value is string => value !== undefined);
	return (
		<>
			<header className="mb-5 flex min-w-0 items-center justify-between gap-4 border-b border-line pb-3">
				<div className="flex min-w-0 items-center gap-3">
					<TileWorkspaceHeaderArtwork identity={identity} />
					<div className="min-w-0">
						<h2
							id="tile-workspace-title"
							className="truncate text-lg font-semibold leading-tight"
						>
							{identity.title}
						</h2>
						{meta.length === 0 ? null : (
							<p className="mt-1 truncate text-sm text-muted">{meta.join(" · ")}</p>
						)}
					</div>
				</div>
				<button
					type="button"
					className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface text-lg leading-none text-muted transition-colors hover:bg-accent/15 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
					aria-label={closeLabel}
					disabled={disabled}
					onClick={() => void workspace.close()}
				>
					×
				</button>
			</header>
			{children}
		</>
	);
};

const UnavailableWorkspace = ({
	closeLabel,
	disabled,
}: {
	readonly closeLabel: string;
	readonly disabled: boolean;
}) => {
	const workspace = useTileWorkspaceControl();
	return (
		<>
			<header className="mb-5 flex min-w-0 items-center justify-between gap-4 border-b border-line pb-3">
				<h2
					id="tile-workspace-title"
					className="text-lg font-semibold"
				>
					Unavailable
				</h2>
				<button
					type="button"
					className="grid size-9 shrink-0 place-items-center rounded-lg border border-line bg-surface text-lg leading-none text-muted transition-colors hover:bg-accent/15 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
					aria-label={closeLabel}
					disabled={disabled}
					onClick={() => void workspace.close()}
				>
					×
				</button>
			</header>
			<div className="grid flex-1 place-items-center text-muted">
				Item is no longer available.
			</div>
		</>
	);
};

const TileInfoWorkspaceContent = ({
	identity,
	itemId,
	phase,
}: {
	readonly identity: Extract<
		useTileIdentity.Projection,
		{
			readonly kind: "available";
		}
	>;
	readonly itemId: TileWorkspaceTarget["itemId"];
	readonly phase: Exclude<TileWorkspacePhase, "closed">;
}) => {
	const workspace = useTileWorkspaceControl();
	const info = useTileInfo(itemId);
	useEffect(() => {
		if (info.kind === "available") return;
		void workspace.close();
	}, [
		info.kind,
		workspace,
	]);
	if (info.kind === "unavailable") {
		return (
			<UnavailableWorkspace
				closeLabel="Close Info"
				disabled={phase === "exiting"}
			/>
		);
	}
	return (
		<TileWorkspaceChrome
			closeLabel="Close Info"
			disabled={phase === "exiting"}
			identity={identity}
		>
			<TileInfoWorkspace
				identity={identity}
				info={info}
			/>
		</TileWorkspaceChrome>
	);
};

const TileLinesWorkspaceContent = ({
	identity,
	itemId,
	phase,
}: {
	readonly identity: Extract<
		useTileIdentity.Projection,
		{
			readonly kind: "available";
		}
	>;
	readonly itemId: TileWorkspaceTarget["itemId"];
	readonly phase: Exclude<TileWorkspacePhase, "closed">;
}) => {
	const workspace = useTileWorkspaceControl();
	const lines = useTileLines(itemId);
	useEffect(() => {
		if (lines.kind === "available") return;
		void workspace.close();
	}, [
		lines.kind,
		workspace,
	]);
	if (lines.kind === "unavailable") {
		return (
			<UnavailableWorkspace
				closeLabel="Close Lines"
				disabled={phase === "exiting"}
			/>
		);
	}
	return (
		<TileWorkspaceChrome
			closeLabel="Close Lines"
			disabled={phase === "exiting"}
			identity={identity}
		>
			<TileLinesWorkspace lines={lines} />
		</TileWorkspaceChrome>
	);
};

const TileEffectsWorkspaceContent = ({
	identity,
	itemId,
	phase,
}: {
	readonly identity: Extract<
		useTileIdentity.Projection,
		{
			readonly kind: "available";
		}
	>;
	readonly itemId: TileWorkspaceTarget["itemId"];
	readonly phase: Exclude<TileWorkspacePhase, "closed">;
}) => {
	const workspace = useTileWorkspaceControl();
	const effects = useTileEffects(itemId);
	useEffect(() => {
		if (effects.kind === "available") return;
		void workspace.close();
	}, [
		effects.kind,
		workspace,
	]);
	if (effects.kind === "unavailable") {
		return (
			<UnavailableWorkspace
				closeLabel="Close Effects"
				disabled={phase === "exiting"}
			/>
		);
	}
	return (
		<TileWorkspaceChrome
			closeLabel="Close Effects"
			disabled={phase === "exiting"}
			identity={identity}
		>
			<TileEffectsWorkspace effects={effects} />
		</TileWorkspaceChrome>
	);
};

const TileStatusWorkspaceContent = ({
	identity,
	itemId,
	phase,
}: {
	readonly identity: Extract<
		useTileIdentity.Projection,
		{
			readonly kind: "available";
		}
	>;
	readonly itemId: TileWorkspaceTarget["itemId"];
	readonly phase: Exclude<TileWorkspacePhase, "closed">;
}) => {
	const workspace = useTileWorkspaceControl();
	const status = useTileStatus(itemId);
	useEffect(() => {
		if (status.kind === "available") return;
		void workspace.close();
	}, [
		status.kind,
		workspace,
	]);
	if (status.kind === "unavailable") {
		return (
			<UnavailableWorkspace
				closeLabel="Close Status"
				disabled={phase === "exiting"}
			/>
		);
	}
	const presentation = readTileStatusPresentation(status.state);
	return (
		<TileWorkspaceChrome
			closeLabel="Close Status"
			contextLabel={presentation.label}
			disabled={phase === "exiting"}
			identity={identity}
		>
			<TileStatusWorkspace
				status={status}
				presentation={presentation}
			/>
		</TileWorkspaceChrome>
	);
};

const TileWorkspaceCapabilityContent = ({
	identity,
	phase,
	target,
}: {
	readonly identity: Extract<
		useTileIdentity.Projection,
		{
			readonly kind: "available";
		}
	>;
	readonly phase: Exclude<TileWorkspacePhase, "closed">;
	readonly target: TileWorkspaceTarget;
}) =>
	match(target.capability)
		.with("info", () => (
			<TileInfoWorkspaceContent
				identity={identity}
				itemId={target.itemId}
				phase={phase}
			/>
		))
		.with("status", () => (
			<TileStatusWorkspaceContent
				identity={identity}
				itemId={target.itemId}
				phase={phase}
			/>
		))
		.with("lines", () => (
			<TileLinesWorkspaceContent
				identity={identity}
				itemId={target.itemId}
				phase={phase}
			/>
		))
		.with("effects", () => (
			<TileEffectsWorkspaceContent
				identity={identity}
				itemId={target.itemId}
				phase={phase}
			/>
		))
		.exhaustive();

const TileWorkspaceDialog = ({
	phase,
	target,
}: {
	readonly phase: Exclude<TileWorkspacePhase, "closed">;
	readonly target: TileWorkspaceTarget;
}) => {
	const workspace = useTileWorkspaceControl();
	const identity = useTileIdentity(target.itemId);
	useEffect(() => {
		if (identity.kind === "available") return;
		void workspace.close();
	}, [
		identity.kind,
		workspace,
	]);
	const motionState = useTileWorkspaceMotion({
		phase,
		generation: target.generation,
	});
	const focus = useTileWorkspaceFocus({
		phase,
		origin: target.origin,
	});

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
				{identity.kind === "available" ? (
					<TileWorkspaceCapabilityContent
						identity={identity}
						phase={phase}
						target={target}
					/>
				) : (
					<UnavailableWorkspace
						closeLabel={`Close ${target.capability}`}
						disabled={phase === "exiting"}
					/>
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

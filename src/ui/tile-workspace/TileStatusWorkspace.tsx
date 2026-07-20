import { match } from "ts-pattern";

import type { useTileStatus } from "~/bridge/tile/useTileStatus";

export interface TileStatusPresentation {
	readonly label: string;
	readonly summary: string;
	readonly detail?: string;
	readonly tone: "positive" | "neutral" | "warning";
}

const storageTitle = (location: "inventory" | "toolbar") =>
	location === "inventory" ? "Inventory" : "Toolbar";

/** Formats one authoritative operational state without deriving gameplay validity. */
export const readTileStatusPresentation = (
	state: useTileStatus.OperationalState,
): TileStatusPresentation =>
	match(state)
		.with(
			{
				kind: "idle",
			},
			() => ({
				label: "Idle",
				summary: "No line can start with the current inputs and conditions.",
				tone: "neutral" as const,
			}),
		)
		.with(
			{
				kind: "ready",
			},
			() => ({
				label: "Ready",
				summary: "At least one line can start immediately.",
				tone: "positive" as const,
			}),
		)
		.with(
			{
				kind: "working",
			},
			() => ({
				label: "Working",
				summary: "An active line is currently running.",
				tone: "positive" as const,
			}),
		)
		.with(
			{
				kind: "stored",
			},
			({ location }) => ({
				label: "Stored",
				summary: `This item is stored in the ${storageTitle(location)}.`,
				detail: "Move it back to the Board before starting work.",
				tone: "neutral" as const,
			}),
		)
		.with(
			{
				kind: "paused",
				reason: {
					kind: "passive-storage",
				},
			},
			({ reason }) => ({
				label: "Paused",
				summary: `Active work is paused while this item is in the ${storageTitle(reason.location)}.`,
				detail: "Return it to the Board and the current work will continue automatically.",
				tone: "warning" as const,
			}),
		)
		.with(
			{
				kind: "paused",
				reason: {
					kind: "dependencies",
				},
			},
			() => ({
				label: "Paused",
				summary: "Current Board dependencies are no longer satisfied.",
				detail: "The active work will continue automatically when its live requirements are restored.",
				tone: "warning" as const,
			}),
		)
		.exhaustive();

const toneClass = {
	positive: "bg-success",
	neutral: "bg-muted",
	warning: "bg-warning",
} as const satisfies Record<TileStatusPresentation["tone"], string>;

/** Renders one concise owner-level operational explanation without line-detail duplication. */
export const TileStatusWorkspace = ({
	status,
	presentation,
}: {
	readonly status: Extract<
		useTileStatus.Projection,
		{
			readonly kind: "available";
		}
	>;
	readonly presentation: TileStatusPresentation;
}) => (
	<div
		className="flex min-h-0 flex-1 flex-col justify-center gap-6 py-6"
		data-ui="TileStatusWorkspace"
		data-status-kind={status.state.kind}
	>
		<div className="flex items-start gap-4">
			<span
				className={`mt-2 size-3 shrink-0 rounded-full ${toneClass[presentation.tone]}`}
				aria-hidden="true"
			/>
			<div className="min-w-0 space-y-2">
				<p className="text-pretty text-2xl font-semibold leading-tight">
					{presentation.summary}
				</p>
				{presentation.detail === undefined ? null : (
					<p className="max-w-3xl text-pretty text-base leading-relaxed text-muted">
						{presentation.detail}
					</p>
				)}
			</div>
		</div>
	</div>
);

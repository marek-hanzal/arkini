import { Button, PrimaryButton } from "~/ui/button/Button";
import type { ItemDetailLinesProjection } from "~/item-line-detail/type/ItemDetailLinesProjection";
import { formatDurationFn } from "~/ui/fn/formatDurationFn";
import { ProductionJobRuntime } from "~/production-job/ui/ProductionJobRuntime";
import { readActiveJobRuntimeFn } from "~/production-job/ui/readActiveJobRuntimeFn";

/** Renders the commands and runtime status for one live production line. */
export const ItemLineCommandPanel = ({
	disabled,
	enqueue,
	line,
	pendingDefault,
	pendingEnqueue,
	setDefault,
	unsetDefault,
}: {
	readonly disabled: boolean;
	readonly enqueue: () => void;
	readonly line: ItemDetailLinesProjection.Line;
	readonly pendingDefault: boolean;
	readonly pendingEnqueue: boolean;
	readonly setDefault: () => void;
	readonly unsetDefault: () => void;
}) => {
	const activeJob = line.activeJob;
	const runtime =
		activeJob === undefined
			? {
					value: formatDurationFn(line.effectiveRuntimeMs),
					detail:
						line.baseRuntimeMs === line.effectiveRuntimeMs
							? "Per cycle"
							: `Base ${formatDurationFn(line.baseRuntimeMs)}`,
				}
			: readActiveJobRuntimeFn(activeJob);
	const unavailable = line.availability.kind === "unavailable";

	return (
		<div className="flex shrink-0 flex-col items-end gap-3">
			<div className="flex flex-wrap justify-end gap-2">
				<Button
					className="min-h-8 px-3 py-1 text-xs"
					cursorIntent={pendingDefault ? "progress" : undefined}
					data-ui="TileLineSetDefaultButton"
					data-default={line.isDefault ? "true" : "false"}
					disabled={disabled || pendingDefault || unavailable}
					onClick={() => {
						if (line.isDefault) {
							unsetDefault();
							return;
						}
						setDefault();
					}}
				>
					{line.isDefault ? "Unset default" : "Set default"}
				</Button>
				<PrimaryButton
					cursorIntent={pendingEnqueue ? "progress" : undefined}
					data-ui="TileLineEnqueueButton"
					disabled={disabled || pendingEnqueue || !line.actions.enqueue.enabled}
					onClick={enqueue}
				>
					Enqueue
				</PrimaryButton>
			</div>
			<ProductionJobRuntime
				dataUi="TileLineRuntime"
				jobStatus={activeJob?.status ?? "idle"}
				runtime={runtime}
			/>
		</div>
	);
};

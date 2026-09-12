import { useTranslator } from "~/translation/ui/useTranslator";
import { Button, PrimaryButton } from "~/ui/ui/Button";
import type { ItemDetailLinesProjection } from "~/item-line-detail/type/ItemDetailLinesProjection";
import { ProductionJobRuntime } from "~/production-job/ui/ProductionJobRuntime";

/** Renders the commands and runtime status for one live production line. */
export const ItemLineCommandPanel = ({
	disabled,
	enqueueFn,
	line,
	pendingSelection,
	pendingEnqueue,
	selectFn,
}: {
	readonly disabled: boolean;
	readonly enqueueFn: () => void;
	readonly line: ItemDetailLinesProjection.Line;
	readonly pendingSelection: boolean;
	readonly pendingEnqueue: boolean;
	readonly selectFn: (selection: "default" | "clock", selected: boolean) => void;
}) => {
	const translator = useTranslator();
	const activeJob = line.activeJob;
	const unavailable = line.availability.kind === "unavailable";

	return (
		<div className="flex shrink-0 flex-col items-end gap-3">
			<div className="flex flex-wrap justify-end gap-2">
				<Button
					className="min-h-8 px-3 py-1 text-xs"
					cursorIntent={pendingSelection ? "progress" : undefined}
					data-ui="TileLineSetDefaultButton"
					data-default={line.isDefault ? "true" : "false"}
					disabled={
						disabled ||
						pendingSelection ||
						unavailable ||
						!line.actions.canChangeDefault
					}
					onClick={() => selectFn("default", !line.isDefault)}
				>
					{translator.textFn(line.isDefault ? "Unset default" : "Set default")}
				</Button>
				{line.clock === undefined ? null : (
					<Button
						className="min-h-8 px-3 py-1 text-xs"
						cursorIntent={pendingSelection ? "progress" : undefined}
						data-ui="TileLineSetClockButton"
						disabled={disabled || pendingSelection || !line.clock.canChange}
						onClick={() => selectFn("clock", !line.clock?.selected)}
					>
						{translator.textFn(line.clock.selected ? "Unset clock" : "Set clock")}
					</Button>
				)}
				<PrimaryButton
					cursorIntent={pendingEnqueue ? "progress" : undefined}
					data-ui="TileLineEnqueueButton"
					disabled={disabled || pendingEnqueue || !line.actions.enqueue.enabled}
					onClick={enqueueFn}
				>
					{translator.textFn("Enqueue")}
				</PrimaryButton>
			</div>
			<ProductionJobRuntime
				dataUi="TileLineRuntime"
				runtime={
					activeJob ?? {
						baseDurationMs: line.baseRuntimeMs,
						durationMs: line.effectiveRuntimeMs,
						status: "idle",
					}
				}
			/>
		</div>
	);
};

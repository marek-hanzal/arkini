import type { LineView } from "~/board/view/LineViewSchema";
import { readLineRunState } from "~/producer/view/readLineRunState";
import { formatMs } from "~/time/formatMs";
import { formatDetailLineMultiplier } from "~/item-detail/control/formatDetailLineMultiplier";
import type { DetailActionControl } from "~/item-detail/control/DetailActionControl";
import type { DetailLineControl } from "~/item-detail/control/DetailLineControl";
import { joinTextParts } from "~/ui/joinTextParts";

export namespace readDetailLineControl {
	export interface Props {
		canSetDefault: boolean;
		line: LineView;
		onSetDefault(lineId: string): void;
		onStart(lineId: string): void;
		onWithdrawInput(lineId: string, itemId: string): void;
		pending: boolean;
	}
}

type LineRunState = ReturnType<typeof readLineRunState>;

const readLineProgressDisplay = (line: LineView) => {
	const progress = line.progress ?? 0;
	return line.kind === "effect" ? 1 - progress : progress;
};

const readLineActionMetaLabel = (line: LineView) =>
	joinTextParts([
		line.kind === "effect"
			? `Window ${formatMs(line.durationMs)}`
			: `Queue ${line.queueUsed}/${line.queueMax}`,
		line.kind === "product" ? formatMs(line.durationMs) : undefined,
		line.effectDurationMultiplier && line.effectDurationMultiplier < 1
			? `faster ${formatDetailLineMultiplier(line.effectDurationMultiplier)}×`
			: line.effectDurationMultiplier && line.effectDurationMultiplier > 1
				? `slowed ${formatDetailLineMultiplier(line.effectDurationMultiplier)}×`
				: undefined,
	]);

const readLineActionLabel = ({ line, runState }: { line: LineView; runState: LineRunState }) => {
	if (!runState.showProgress) return runState.label;

	const statusLabel =
		line.remainingMs === undefined ? "Queued" : (runState.progressLabel ?? "Running");
	const timeLabel = line.remainingMs === undefined ? undefined : formatMs(line.remainingMs);
	const queuedLabel = line.jobs > 1 ? `+${line.jobs - 1} queued` : undefined;

	return joinTextParts([
		statusLabel,
		timeLabel,
		queuedLabel,
	]);
};

const readWithdrawInputActionsByItemId = ({
	line,
	onWithdrawInput,
	pending,
}: {
	line: LineView;
	onWithdrawInput(lineId: string, itemId: string): void;
	pending: boolean;
}) => {
	const withdrawDisabled = pending || line.inProgress;

	return Object.fromEntries(
		line.inputs.flatMap((input) => {
			if (input.stored <= 0) return [];

			const action: DetailActionControl = {
				disabled: withdrawDisabled,
				label: "Withdraw",
				onClick: () => {
					if (withdrawDisabled) return;
					onWithdrawInput(line.lineId, input.itemId);
				},
				tone: "secondary",
			};

			return [
				[
					input.itemId,
					action,
				],
			];
		}),
	) satisfies Readonly<Record<string, DetailActionControl | undefined>>;
};

export const readDetailLineControl = ({
	canSetDefault,
	line,
	onSetDefault,
	onStart,
	onWithdrawInput,
	pending,
}: readDetailLineControl.Props): DetailLineControl => {
	const runState = readLineRunState({
		line,
	});
	const primaryActionDisabled = runState.showProgress || !runState.canRunAction || pending;
	const defaultActionDisabled = pending || line.visible === false;
	const defaultAction = canSetDefault
		? ({
				disabled: defaultActionDisabled,
				label: line.isDefault ? "Un-default" : "Default",
				onClick: () => {
					if (defaultActionDisabled) return;
					onSetDefault(line.lineId);
				},
				tone: "secondary",
			} satisfies DetailActionControl)
		: undefined;

	return {
		defaultAction,
		primaryAction: {
			disabled: primaryActionDisabled,
			label: readLineActionLabel({
				line,
				runState,
			}),
			metaLabel: readLineActionMetaLabel(line),
			onClick: () => {
				if (primaryActionDisabled) return;
				onStart(line.lineId);
			},
			progress: runState.showProgress ? readLineProgressDisplay(line) : undefined,
			tone: "primary",
		},
		withdrawInputActionsByItemId: readWithdrawInputActionsByItemId({
			line,
			onWithdrawInput,
			pending,
		}),
	};
};

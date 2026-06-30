import type { ProducerProductLineView } from "~/v0/board/view/ProducerProductLineViewSchema";
import { readProducerProductLineRunState } from "~/v0/producer/logic/readProducerProductLineRunState";
import { formatMs } from "~/v0/time/formatMs";
import type { DetailActionControl } from "~/v1/item-detail/control/DetailActionControl";
import type { DetailProducerLineControl } from "~/v1/item-detail/control/DetailProducerLineControl";

export namespace readDetailProducerLineControl {
	export interface Props {
		canSetDefault: boolean;
		line: ProducerProductLineView;
		onSetDefault(productId: string): void;
		onStart(productId: string): void;
		onWithdrawInput(productId: string, itemId: string): void;
		pending: boolean;
	}
}

type LineRunState = ReturnType<typeof readProducerProductLineRunState>;

const readLineProgressDisplay = (line: ProducerProductLineView) => {
	const progress = line.progress ?? 0;
	return line.lineKind === "effect" ? 1 - progress : progress;
};

const readLineActionLabel = ({
	line,
	runState,
}: {
	line: ProducerProductLineView;
	runState: LineRunState;
}) => {
	if (!runState.showProgress) return runState.label;

	const statusLabel =
		line.remainingMs === undefined ? "Queued" : (runState.progressLabel ?? "Running");
	const timeLabel = line.remainingMs === undefined ? undefined : formatMs(line.remainingMs);
	const queuedLabel = line.queuedJobs > 1 ? `+${line.queuedJobs - 1} queued` : undefined;

	return [
		statusLabel,
		timeLabel,
		queuedLabel,
	]
		.filter(Boolean)
		.join(" · ");
};

const readWithdrawInputActionsByItemId = ({
	line,
	onWithdrawInput,
	pending,
}: {
	line: ProducerProductLineView;
	onWithdrawInput(productId: string, itemId: string): void;
	pending: boolean;
}) =>
	Object.fromEntries(
		line.inputs.flatMap((input) => {
			if (input.stored <= 0) return [];

			const action: DetailActionControl = {
				disabled: pending,
				label: "Withdraw",
				onClick: () => {
					if (pending) return;
					onWithdrawInput(line.productId, input.itemId);
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

export const readDetailProducerLineControl = ({
	canSetDefault,
	line,
	onSetDefault,
	onStart,
	onWithdrawInput,
	pending,
}: readDetailProducerLineControl.Props): DetailProducerLineControl => {
	const runState = readProducerProductLineRunState({
		line,
	});
	const primaryActionDisabled = runState.showProgress || !runState.canRunAction || pending;
	const defaultActionDisabled = pending;
	const defaultAction = canSetDefault
		? ({
				disabled: defaultActionDisabled,
				label: line.isDefault ? "Un-default" : "Default",
				onClick: () => {
					if (defaultActionDisabled) return;
					onSetDefault(line.productId);
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
			onClick: () => {
				if (primaryActionDisabled) return;
				onStart(line.productId);
			},
			progress: runState.showProgress ? readLineProgressDisplay(line) : undefined,
			progressAutoCompleteMs: runState.progressAutoCompleteMs,
			progressAutoCompleteTo: line.lineKind === "effect" ? "empty" : "full",
			tone: "primary",
		},
		withdrawInputActionsByItemId: readWithdrawInputActionsByItemId({
			line,
			onWithdrawInput,
			pending,
		}),
	};
};

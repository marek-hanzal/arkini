import type { CraftProgressView } from "~/board/view/CraftProgressViewSchema";
import { readCraftRunState } from "~/craft/logic/readCraftRunState";
import type { DetailActionControl } from "~/item-detail/control/DetailActionControl";
import type { DetailCraftControl } from "~/item-detail/control/DetailCraftControl";
import { craftStatusLabel } from "~/item-detail/logic/craftStatusLabel";

export namespace readDetailCraftControl {
	export interface Props {
		craft: CraftProgressView;
		onClaim(): void;
		onStart(): void;
		onWithdrawInput(itemId: string): void;
		pending: boolean;
	}
}

const readWithdrawInputActionsByItemId = ({
	craft,
	onWithdrawInput,
	pending,
}: {
	craft: CraftProgressView;
	onWithdrawInput(itemId: string): void;
	pending: boolean;
}) =>
	Object.fromEntries(
		craft.inputs.flatMap((input) => {
			const delivered = craft.delivered[input.itemId] ?? 0;
			if (craft.phase !== "collecting_inputs" || delivered <= 0) return [];

			const action: DetailActionControl = {
				disabled: pending,
				label: "Withdraw",
				onClick: () => {
					if (pending) return;
					onWithdrawInput(input.itemId);
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

export const readDetailCraftControl = ({
	craft,
	onClaim,
	onStart,
	onWithdrawInput,
	pending,
}: readDetailCraftControl.Props): DetailCraftControl => {
	const runState = readCraftRunState({
		craft,
	});
	const primaryActionDisabled = (!runState.canRunAction && !runState.canClaim) || pending;

	return {
		primaryAction: {
			disabled: primaryActionDisabled,
			label: runState.label,
			onClick: () => {
				if (primaryActionDisabled) return;
				if (runState.canClaim) {
					onClaim();
					return;
				}
				onStart();
			},
			progress: craft.progress,
			tone: "primary",
		},
		statusLabel: craftStatusLabel({
			craft,
		}),
		withdrawInputActionsByItemId: readWithdrawInputActionsByItemId({
			craft,
			onWithdrawInput,
			pending,
		}),
	};
};

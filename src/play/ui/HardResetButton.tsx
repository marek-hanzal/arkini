import { useMachine } from "@xstate/react";
import type { FC } from "react";
import { hardResetDatabaseFile } from "~/play/logic/resetDatabaseFile";
import { resetWorkflowMachine } from "~/shared/logic/resetWorkflowMachine";
import { logResetError } from "~/shared/util/logResetError";
import { reloadWindow } from "~/shared/util/reloadWindow";

export namespace HardResetButton {
	export interface Props {
		label?: string;
	}
}

export const HardResetButton: FC<HardResetButton.Props> = ({ label = "Hard reset database" }) => {
	const [resetState, sendReset] = useMachine(resetWorkflowMachine, {
		input: {
			reset: hardResetDatabaseFile,
			onSuccess: reloadWindow,
			onError: logResetError,
		},
	});
	const pending = resetState.matches("pending");
	const failed = resetState.matches("failed");

	return (
		<div>
			<button
				type="button"
				disabled={pending}
				onClick={() =>
					sendReset({
						type: "START",
					})
				}
				className="w-full rounded-md border border-red-300/45 bg-red-300 px-4 py-3 text-sm font-black text-slate-950 active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"
			>
				{pending ? "Dropping database…" : label}
			</button>
			{failed ? (
				<p className="mt-3 text-sm text-red-100">Reset failed. Check the console.</p>
			) : null}
		</div>
	);
};

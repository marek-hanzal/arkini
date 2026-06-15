import type { FC } from "react";
import { useHardResetAction } from "~/shared/hook/useHardResetAction";
import { hardResetBrowserStorage } from "~/shared/util/hardResetBrowserStorage";
import { logResetError } from "~/shared/util/logResetError";
import { reloadWindow } from "~/shared/util/reloadWindow";

export namespace HardResetButton {
	export interface Props {
		label?: string;
	}
}

export const HardResetButton: FC<HardResetButton.Props> = ({ label = "Hard reset OPFS" }) => {
	const reset = useHardResetAction({
		reset: hardResetBrowserStorage,
		onSuccess: reloadWindow,
		onError: logResetError,
	});

	return (
		<div>
			<button
				type="button"
				disabled={reset.pending}
				onClick={() => void reset.run()}
				className="w-full rounded-md border border-red-300/45 bg-red-300 px-4 py-3 text-sm font-black text-slate-950 disabled:cursor-wait disabled:opacity-60"
			>
				{reset.pending ? "Dropping OPFS storage…" : label}
			</button>
			{reset.failed ? (
				<p className="mt-3 text-sm text-red-100">Reset failed. Check the console.</p>
			) : null}
		</div>
	);
};

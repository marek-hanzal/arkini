import { useAtom } from "@effect/atom-react";
import { useState } from "react";
import { SettingsHardResetAtom } from "~/application-settings/atom/SettingsHardResetAtom";
import { DangerButton } from "~/ui/ui/Button";

/** The first click arms this mounted control; only a second click requests deletion. */
export const SettingsHardReset = () => {
	const [armed, setArmedFn] = useState(false);
	const [state, resetFn] = useAtom(SettingsHardResetAtom);
	const pending = state.kind === "pending";
	return (
		<div
			data-ui="SettingsHardReset"
			className="ak-list-row flex items-center justify-between gap-4 px-4 py-3"
		>
			<span className="grid gap-1">
				<span className="text-sm font-semibold text-foreground">Hard reset</span>
				<span className="text-sm leading-5 text-muted">
					Permanently delete all Serakki data: saves, editor projects, Serapacks,
					settings, and logs. The app will restart clean.
				</span>
				{state.kind === "error" ? (
					<span className="text-sm text-danger">
						Reset failed:{" "}
						{state.error instanceof Error ? state.error.message : String(state.error)}
					</span>
				) : null}
			</span>
			<DangerButton
				className="shrink-0"
				disabled={pending}
				cursorIntent={pending ? "progress" : undefined}
				onClick={() => {
					if (!armed) {
						setArmedFn(true);
						return;
					}
					setArmedFn(false);
					resetFn(undefined);
				}}
			>
				{pending ? "Resetting…" : armed ? "Really?" : "Hard reset"}
			</DangerButton>
		</div>
	);
};

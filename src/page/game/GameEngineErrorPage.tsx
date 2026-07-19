import type { ErrorComponentProps } from "@tanstack/react-router";
import { useState } from "react";

import { GameSaveBootstrapError } from "~/bridge/game/GameSaveBootstrapError";
import { RendererRuntime } from "~/bridge/runtime/RendererRuntime";
import { deleteGameSaveFx } from "~/bridge/save/deleteGameSaveFx";
import { ActionErrorPage } from "~/page/action/ActionErrorPage";
import { PrimaryButton } from "~/ui/button/Button";

/** Presents exact game bootstrap failure and verified invalid-save recovery. */
export const GameEngineErrorPage = ({ error, reset }: ErrorComponentProps) => {
	const [recovering, setRecovering] = useState(false);
	const [recoveryError, setRecoveryError] = useState<unknown>();
	if (!(error instanceof GameSaveBootstrapError)) {
		return (
			<ActionErrorPage
				description="The selected package could not create a playable Game Engine."
				error={error}
				reset={reset}
				title="Game failed to load"
			/>
		);
	}

	const recover = () => {
		if (recovering) return;
		setRecovering(true);
		setRecoveryError(undefined);
		void RendererRuntime.runPromise(
			deleteGameSaveFx({
				key: error.saveKey,
			}),
		)
			.then(reset)
			.catch(setRecoveryError)
			.finally(() => setRecovering(false));
	};

	return (
		<ActionErrorPage
			description="The persisted save is invalid. Retry the exact load or delete only this verified package save and create a fresh game."
			error={recoveryError ?? error}
			reset={reset}
			title="Saved game could not be restored"
		>
			<PrimaryButton
				disabled={recovering}
				onClick={recover}
			>
				{recovering ? "Clearing failed save…" : "Recover with a fresh save"}
			</PrimaryButton>
		</ActionErrorPage>
	);
};

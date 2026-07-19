import { CriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";
import { GameSaveBootstrapError } from "~/bridge/game/GameSaveBootstrapError";
import { ActionErrorPage } from "~/ui/action/ActionErrorPage";
import { PrimaryButtonLink } from "~/ui/button/Button";

export namespace GameEngineErrorView {
	export interface Props {
		readonly error: unknown;
		readonly retry: () => void;
	}
}

/** Presents one bootstrap failure without owning recovery or Game lifecycle work. */
export const GameEngineErrorView = ({ error, retry }: GameEngineErrorView.Props) => {
	if (error instanceof CriticalGameLifecycleError) throw error;
	if (!(error instanceof GameSaveBootstrapError)) {
		return (
			<ActionErrorPage
				description="The selected package could not create a playable Game Engine."
				error={error}
				reset={retry}
				title="Game failed to load"
			/>
		);
	}

	return (
		<ActionErrorPage
			description="The persisted save is invalid. Retry the exact load or open the dedicated recovery action to delete only this verified package save."
			error={error}
			reset={retry}
			title="Saved game could not be restored"
		>
			<PrimaryButtonLink
				to="/action/recover-game-save"
				search={{
					packageId: error.saveKey.packageId,
				}}
				preload={false}
			>
				Recover with a fresh save
			</PrimaryButtonLink>
		</ActionErrorPage>
	);
};

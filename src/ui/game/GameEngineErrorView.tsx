import { CriticalGameLifecycleError } from "~/bridge/game/CriticalGameLifecycleError";
import { GameSaveBootstrapError } from "~/bridge/game/GameSaveBootstrapError";
import { ActionErrorPage } from "~/ui/action/ActionErrorPage";
import { DangerButtonLink, PrimaryButtonLink } from "~/ui/button/Button";

export namespace GameEngineErrorView {
	export interface Props {
		readonly error: unknown;
		readonly packageId: string;
	}
}

/** Presents one bootstrap failure with an explicit safe exit instead of replaying the same load. */
export const GameEngineErrorView = ({ error, packageId }: GameEngineErrorView.Props) => {
	if (error instanceof CriticalGameLifecycleError) throw error;
	if (!(error instanceof GameSaveBootstrapError)) {
		return (
			<ActionErrorPage
				description="The selected package could not create a playable Game Engine."
				error={error}
				title="Game failed to load"
			>
				<PrimaryButtonLink
					to="/action/discard-failed-game"
					search={{
						packageId,
					}}
					preload={false}
					replace
				>
					Exit to Main Menu
				</PrimaryButtonLink>
			</ActionErrorPage>
		);
	}

	return (
		<ActionErrorPage
			description="This save is incompatible or corrupted. Cleaning it will permanently delete progress for this exact package build and return to the Main Menu."
			error={error.cause}
			title="Saved game could not be restored"
		>
			<DangerButtonLink
				to="/action/recover-game-save"
				search={{
					packageId: error.saveKey.packageId,
				}}
				preload={false}
				replace
			>
				Clean &amp; Exit
			</DangerButtonLink>
		</ActionErrorPage>
	);
};

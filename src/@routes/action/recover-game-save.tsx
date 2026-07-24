import {
	createFileRoute,
	redirect,
	type ErrorComponentProps,
	useRouter,
} from "@tanstack/react-router";

import { recoverFailedGameSaveFx } from "~/bridge/game/recoverFailedGameSaveFx";
import { ActionErrorPage } from "~/ui/action/ActionErrorPage";
import { ActionPendingPage } from "~/page/action/ActionPendingPage";
import { runActionRouteFx } from "~/page/action/runActionRouteFx";
import { GameSaveRecoverySearchSchema } from "~/ui/navigation/GameSaveRecoverySearchSchema";

export const Route = createFileRoute("/action/recover-game-save")({
	validateSearch: GameSaveRecoverySearchSchema,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		await context.rendererRuntime.runPromise(
			runActionRouteFx(recoverFailedGameSaveFx(deps.packageId)),
		);
		throw redirect({
			to: "/main-menu",
			replace: true,
		});
	},
	pendingMs: 0,
	pendingMinMs: 2_500,
	pendingComponent: () => <ActionPendingPage label="Clearing failed save…" />,
	errorComponent: RecoverGameSaveErrorPage,
});

function RecoverGameSaveErrorPage(props: ErrorComponentProps) {
	const router = useRouter();
	return (
		<ActionErrorPage
			{...props}
			description="Arkini could not delete the exact verified save. No other save was changed, and automatic Game loading will not resume."
			reset={() => {
				void router.invalidate().catch(() => undefined);
			}}
			resetLabel="Retry cleanup"
			title="Save recovery failed"
		/>
	);
}

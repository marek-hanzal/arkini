import {
	createFileRoute,
	redirect,
	type ErrorComponentProps,
	useRouter,
} from "@tanstack/react-router";

import { discardFailedGameEngineFx } from "~/bridge/game/discardFailedGameEngineFx";
import { ActionPendingPage } from "~/page/action/ActionPendingPage";
import { runActionRouteFx } from "~/page/action/runActionRouteFx";
import { ActionErrorPage } from "~/ui/action/ActionErrorPage";
import { FailedGameDiscardSearchSchema } from "~/ui/navigation/FailedGameDiscardSearchSchema";

export const Route = createFileRoute("/action/discard-failed-game")({
	validateSearch: FailedGameDiscardSearchSchema,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		await context.rendererRuntime.runPromise(
			runActionRouteFx(discardFailedGameEngineFx(deps.packageId)),
		);
		throw redirect({
			to: "/main-menu",
			replace: true,
		});
	},
	pendingMs: 0,
	pendingMinMs: 2_500,
	pendingComponent: () => <ActionPendingPage label="Leaving failed game…" />,
	errorComponent: DiscardFailedGameErrorPage,
});

function DiscardFailedGameErrorPage(props: ErrorComponentProps) {
	const router = useRouter();
	return (
		<ActionErrorPage
			{...props}
			description="Arkini could not discard the exact failed Game bootstrap state. No save was deleted and no replacement Game was removed."
			reset={() => {
				void router.invalidate().catch(() => undefined);
			}}
			resetLabel="Retry exit"
			title="Game exit failed"
		/>
	);
}

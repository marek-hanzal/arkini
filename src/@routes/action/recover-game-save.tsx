import {
	createFileRoute,
	redirect,
	type ErrorComponentProps,
	useRouter,
} from "@tanstack/react-router";
import { Effect } from "effect";
import { z } from "zod";

import { runActionRouteFx } from "~/@routes/action/-runActionRouteFx";
import { GameEngineResourceFx } from "~/renderer/game/resource/GameEngineResourceFx";
import { ActionErrorPage } from "~/launcher/ui/ActionErrorPage";
import { ActionLoadingScreen } from "~/launcher/ui/ActionLoadingScreen";

const GameSaveRecoverySearchSchema = z
	.object({
		packageId: z.string().min(1),
	})
	.strict();

export const Route = createFileRoute("/action/recover-game-save")({
	validateSearch: GameSaveRecoverySearchSchema,
	loaderDeps: ({ search }) => search,
	loader: async ({ context, deps }) => {
		await context.rendererRuntime.runPromise(
			runActionRouteFx(
				GameEngineResourceFx.pipe(
					Effect.flatMap((service) =>
						service.recoverFailedSaveFx({
							packageId: deps.packageId,
						}),
					),
				),
			),
		);
		throw redirect({
			to: "/main-menu",
			replace: true,
		});
	},
	pendingMs: 0,
	pendingMinMs: 2_500,
	pendingComponent: () => <ActionLoadingScreen label="Clearing failed save…" />,
	errorComponent: (props: ErrorComponentProps) => {
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
	},
});

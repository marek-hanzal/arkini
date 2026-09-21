import { app } from "electron";
import { Effect } from "effect";
import { applicationHardResetArgument } from "./consumeApplicationHardResetFx";

/** Exit without renderer save-on-close; only the next, exclusive process removes data. */
export const requestApplicationHardResetFx = Effect.try({
	try: () => {
		app.relaunch({
			args: [
				...process.argv
					.slice(1)
					.filter((argument) => argument !== applicationHardResetArgument),
				applicationHardResetArgument,
			],
		});
		app.exit(0);
	},
	catch: (cause) => cause,
});

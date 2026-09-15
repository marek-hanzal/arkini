import { Effect } from "effect";
import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { GameIncidentWrite } from "~electron/contract/incident/GameIncidentWrite";
import { GameIncidentFiles } from "~shared/GameIncidentMetadata";
import { readArkpackArtifactNameFn } from "~/arkpack-artifact/fn/readArkpackArtifactNameFn";
import { readArkpackFileLayoutFx } from "~/arkpack-artifact/fx/readArkpackFileLayoutFx";

export namespace writeLatestGameIncidentFx {
	export interface Props {
		readonly bundledArkpacksRoot: string;
		readonly incidentsRoot: string;
		readonly incident: GameIncidentWrite;
		readonly userArkpacksRoot: string;
	}
}

/** Overwrites the one disposable failed-session environment exposed to local tooling. */
export const writeLatestGameIncidentFx = Effect.fn("writeLatestGameIncidentFx")(
	({
		bundledArkpacksRoot,
		incidentsRoot,
		incident,
		userArkpacksRoot,
	}: writeLatestGameIncidentFx.Props) =>
		Effect.gen(function* () {
			const arkpackPath = join(
				incident.arkpack.source === "bundled" ? bundledArkpacksRoot : userArkpacksRoot,
				readArkpackArtifactNameFn(incident.arkpack.packageId),
			);
			const layout = yield* readArkpackFileLayoutFx(arkpackPath);
			if (layout.contentHash !== incident.arkpack.contentHash)
				return yield* Effect.fail(
					new Error(
						"The installed Arkpack changed before its incident could be archived.",
					),
				);
			yield* Effect.tryPromise({
				try: async () => {
					const directory = join(incidentsRoot, GameIncidentFiles.directory);
					await mkdir(directory, {
						recursive: true,
					});
					await rm(join(directory, "diagnostics.jsonl"), {
						force: true,
					});
					await copyFile(arkpackPath, join(directory, GameIncidentFiles.arkpack));
					await writeFile(join(directory, GameIncidentFiles.save), incident.saveBytes);
					await writeFile(
						join(directory, GameIncidentFiles.incident),
						incident.text.incident,
						"utf8",
					);
					await writeFile(
						join(directory, GameIncidentFiles.failure),
						incident.text.failure,
						"utf8",
					);
					await writeFile(
						join(directory, GameIncidentFiles.history),
						incident.text.history,
						"utf8",
					);
					await writeFile(
						join(directory, GameIncidentFiles.runtimeState),
						incident.text.runtimeState,
						"utf8",
					);
				},
				catch: (cause) => cause,
			});
		}),
);

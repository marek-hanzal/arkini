import { Effect } from "effect";
import { importEditorResourcesFx } from "~/resource-authoring/fx/importEditorResourcesFx";

type ImportEditorArtworkProps =
	| {
			readonly file: File;
			readonly projectId: string;
			readonly source: "serapack";
	  }
	| {
			readonly files: ReadonlyArray<File>;
			readonly projectId: string;
			readonly source: "files";
	  };

/** Imports selected artwork by native path and publishes the resulting project. */
export const importEditorArtworkFx = Effect.fn("importEditorArtworkFx")(
	(props: ImportEditorArtworkProps) =>
		importEditorResourcesFx({
			...props,
			type: "artwork",
		}),
);

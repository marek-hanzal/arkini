import { Data } from "effect";

/** The saved working copy became destructive after the UI last evaluated consent. */
export class ProjectVersionCheckoutConfirmationRequired extends Data.TaggedError(
	"EditorProjectVersionCheckoutConfirmationRequired",
)<{}> {
	override get message(): string {
		return "The editor project has unversioned saved changes that must be confirmed before restore.";
	}
}

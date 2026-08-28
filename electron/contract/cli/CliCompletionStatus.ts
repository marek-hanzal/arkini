export type CliCompletionShell = "bash" | "fish" | "zsh";

export type CliCompletionStatus =
	| {
			readonly type: "installed";
			readonly completionPath: string;
			readonly shell: CliCompletionShell;
	  }
	| {
			readonly type: "not-installed";
			readonly completionPath: string;
			readonly shell: CliCompletionShell;
	  }
	| {
			readonly type: "repairable";
			readonly completionPath: string;
			readonly shell: CliCompletionShell;
			readonly message: string;
	  }
	| {
			readonly type: "conflict";
			readonly completionPath: string;
			readonly shell: CliCompletionShell;
			readonly message: string;
			readonly replaceable: boolean;
	  }
	| {
			readonly type: "unavailable";
			readonly message: string;
	  };

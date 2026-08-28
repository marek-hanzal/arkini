export type CompletionShell = "bash" | "fish" | "zsh";

export type CompletionStatus =
	| {
			readonly type: "installed";
			readonly completionPath: string;
			readonly shell: CompletionShell;
	  }
	| {
			readonly type: "not-installed";
			readonly completionPath: string;
			readonly shell: CompletionShell;
	  }
	| {
			readonly type: "repairable";
			readonly completionPath: string;
			readonly shell: CompletionShell;
			readonly message: string;
	  }
	| {
			readonly type: "conflict";
			readonly completionPath: string;
			readonly shell: CompletionShell;
			readonly message: string;
			readonly replaceable: boolean;
	  }
	| {
			readonly type: "unavailable";
			readonly message: string;
	  };

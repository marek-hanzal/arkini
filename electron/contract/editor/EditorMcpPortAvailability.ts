export type EditorMcpPortAvailability =
	| {
			readonly type: "available";
	  }
	| {
			readonly type: "unavailable";
			readonly message: string;
	  };

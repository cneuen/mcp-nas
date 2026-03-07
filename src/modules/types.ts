export interface McpModule {
    name: string;
    isSupported(executeOnNas: (cmd: string) => Promise<string>): Promise<boolean>;
    getTools(): any[];
    handleCall(name: string, args: any, executeOnNas: (cmd: string) => Promise<string>): Promise<{ content: { type: string, text: string }[], isError?: boolean } | null>;
}

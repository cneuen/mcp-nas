#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
    Tool,
} from "@modelcontextprotocol/sdk/types.js";

import { Client, ConnectConfig } from "ssh2";
import * as fs from "fs";

import { McpModule } from "./modules/types.js";
import { omvModule } from "./modules/omv.js";
import { dockerModule } from "./modules/docker.js";
import { crowdsecModule } from "./modules/crowdsec.js";

/**
 * MCP-NAS Server
 * Standardized management for Homelab Servers
 */
const server = new Server(
    {
        name: "mcp-nas",
        version: "0.2.0",
    },
    {
        capabilities: {
            tools: {},
        },
    }
);

/**
 * Configuration from environment
 */
const NAS_HOST = process.env.NAS_HOST;
const NAS_PORT = parseInt(process.env.NAS_PORT || "22");
const NAS_USER = process.env.NAS_USER;
const NAS_KEY_PATH = process.env.NAS_KEY_PATH; // Optional

if (!NAS_HOST || !NAS_USER) {
    console.error("Missing mandatory environment variables: NAS_HOST and NAS_USER must be set.");
    process.exit(1);
}

/**
 * Execute a command on the NAS via SSH
 */
async function executeOnNas(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        conn.on("ready", () => {
            console.error("SSH: Connected and authenticated successfully");
            conn.exec(command, (err, stream) => {
                if (err) {
                    conn.end();
                    return reject(err);
                }
                let output = "";
                let errorOutput = "";
                stream.on("close", (code: number) => {
                    conn.end();
                    if (code !== 0) {
                        reject(new Error(`Exit code ${code}: ${errorOutput || output}`));
                    } else {
                        const finalOut = (output + (errorOutput ? "\n" + errorOutput : "")).trim();
                        resolve(finalOut);
                    }
                }).on("data", (data: Buffer) => {
                    output += data.toString();
                }).stderr.on("data", (data: Buffer) => {
                    errorOutput += data.toString();
                });
            });
        }).on("error", (err) => {
            console.error("SSH Connection Error:", err.message);
            reject(err);
        });

        console.error(`SSH: Attempting connection to ${NAS_HOST}:${NAS_PORT} as ${NAS_USER}`);

        const connectConfig: ConnectConfig = {
            host: NAS_HOST,
            port: NAS_PORT,
            username: NAS_USER,
            // Authentication logic: either key or agent (ssh-agent)
            agent: process.env.SSH_AUTH_SOCK,
        };

        if (NAS_KEY_PATH) {
            try {
                console.error(`SSH: Reading key from ${NAS_KEY_PATH}`);
                const keyData = fs.readFileSync(NAS_KEY_PATH);
                console.error(`SSH: Key loaded, size: ${keyData.length} bytes`);
                connectConfig.privateKey = keyData;
            } catch (keyErr: any) {
                console.error(`SSH: Failed to read key file: ${keyErr.message}`);
            }
        } else {
            console.error("SSH: No NAS_KEY_PATH provided, attempting other methods (agent/password)");
        }

        conn.connect(connectConfig);
    });
}

/**
 * Available modules
 */
const allModules: McpModule[] = [omvModule, dockerModule, crowdsecModule];

/**
 * List available tools by aggregating across supported modules
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools: Tool[] = [];

    // Check support for all modules in parallel
    await Promise.all(allModules.map(async (mod) => {
        try {
            const isSupported = await mod.isSupported(executeOnNas);
            if (isSupported) {
                tools.push(...mod.getTools());
            }
        } catch (err) {
            console.error(`Error checking support for module ${mod.name}:`, err);
        }
    }));

    return { tools };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request: { params: { name: string, arguments?: any } }) => {
    const { name } = request.params;
    try {
        // Find the module that can handle this tool
        for (const mod of allModules) {
            const result = await mod.handleCall(name, request.params.arguments, executeOnNas);
            if (result) {
                return result;
            }
        }

        throw new Error(`Unknown tool: ${name}. Ensure the required module is supported on your system.`);
    } catch (error) {
        return {
            content: [
                {
                    type: "text",
                    text: `Error contacting NAS: ${error instanceof Error ? error.message : String(error)}`,
                },
            ],
            isError: true,
        };
    }
});

/**
 * Start the server
 */
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP-NAS Server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});

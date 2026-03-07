import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import { Client, ConnectConfig } from "ssh2";
import * as fs from "fs";

/**
 * MCP-OMV Server
 * Standardized management for OpenMediaVault and Docker
 */
const server = new Server(
    {
        name: "mcp-omv",
        version: "0.1.0",
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
const NAS_HOST = process.env.NAS_HOST || "192.168.1.27";
const NAS_PORT = parseInt(process.env.NAS_PORT || "8822");
const NAS_USER = process.env.NAS_USER || "cneuen";
const NAS_KEY_PATH = process.env.NAS_KEY_PATH; // Optional

/**
 * Execute a command on the NAS via SSH
 */
async function executeOnNas(command: string): Promise<string> {
    return new Promise((resolve, reject) => {
        const conn = new Client();
        conn.on("ready", () => {
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
                        reject(new Error(`Exit code ${code}: ${errorOutput}`));
                    } else {
                        resolve(output);
                    }
                }).on("data", (data: Buffer) => {
                    output += data.toString();
                }).stderr.on("data", (data: Buffer) => {
                    errorOutput += data.toString();
                });
            });
        }).on("error", (err) => {
            reject(err);
        });

        const connectConfig: ConnectConfig = {
            host: NAS_HOST,
            port: NAS_PORT,
            username: NAS_USER,
            // Authentication logic: either key or agent (ssh-agent)
            agent: process.env.SSH_AUTH_SOCK,
        };

        if (NAS_KEY_PATH) {
            connectConfig.privateKey = fs.readFileSync(NAS_KEY_PATH);
        }

        conn.connect(connectConfig);
    });
}

/**
 * List available tools
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "get_system_stats",
                description: "Get general OMV system stats (CPU, RAM, Uptime)",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
            {
                name: "list_containers",
                description: "List all Docker containers on the NAS",
                inputSchema: {
                    type: "object",
                    properties: {},
                },
            },
        ],
    };
});

/**
 * Handle tool calls
 */
server.setRequestHandler(CallToolRequestSchema, async (request: { params: { name: string, arguments?: any } }) => {
    const { name } = request.params;

    try {
        if (name === "get_system_stats") {
            const command = `omv-rpc -u admin 'System' 'getInformation' '{}'`;
            const result = await executeOnNas(command);
            const data = JSON.parse(result);

            return {
                content: [
                    {
                        type: "text",
                        text: `System Info for ${data.hostname}:\n- Kernel: ${data.kernel}\n- CPU: ${data.cpu}\n- Uptime: ${data.uptime}\n- Load: ${data.loadAverage}`,
                    },
                ],
            };
        }

        if (name === "list_containers") {
            const command = `docker ps --format "{{.Names}} ({{.Status}})"`;
            const result = await executeOnNas(command);
            return {
                content: [
                    {
                        type: "text",
                        text: result || "No containers running.",
                    },
                ],
            };
        }

        throw new Error(`Unknown tool: ${name}`);
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
    console.error("MCP-OMV Server running on stdio");
}

main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});

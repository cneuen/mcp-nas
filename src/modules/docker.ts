import { McpModule } from "./types.js";

export const dockerModule: McpModule = {
    name: "docker",
    async isSupported(executeOnNas) {
        try {
            await executeOnNas("which docker");
            return true;
        } catch {
            return false;
        }
    },
    getTools() {
        return [
            {
                name: "list_containers",
                description: "List all Docker containers on the NAS",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "get_docker_stats",
                description: "Get detailed CPU/RAM usage for each Docker container",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "get_container_logs",
                description: "Get recent logs for a specific container, or all containers if none specified",
                inputSchema: {
                    type: "object",
                    properties: {
                        containerName: {
                            type: "string",
                            description: "Optional. Name of the container."
                        },
                        sinceMinutes: {
                            type: "number",
                            description: "Optional. Number of minutes of logs to retrieve (default: 10)."
                        }
                    },
                },
            },
            {
                name: "manage_native_container",
                description: "Start, Stop, or Restart a native Docker container",
                inputSchema: {
                    type: "object",
                    properties: {
                        name: { type: "string", description: "Container name" },
                        action: { type: "string", enum: ["start", "stop", "restart"], description: "Action to perform" }
                    },
                    required: ["name", "action"]
                },
            },
            {
                name: "list_native_stacks",
                description: "List all native Docker Compose stacks",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "update_native_stack",
                description: "Pull latest images and restart all services in a native Docker Compose stack",
                inputSchema: {
                    type: "object",
                    properties: {
                        projectName: { type: "string", description: "Name of the compose project/stack" },
                        workingDir: { type: "string", description: "Full path to the directory containing docker-compose.yml" }
                    },
                    required: ["projectName", "workingDir"]
                },
            },
        ];
    },
    async handleCall(name, args, executeOnNas) {
        const cmdPrefix = "sudo ";
        if (name === "list_containers") {
            const cmd = `${cmdPrefix}/usr/bin/docker ps --format "{{.Names}} ({{.Status}})"`;
            const result = await executeOnNas(cmd);
            return { content: [{ type: "text", text: result || "No containers running." }] };
        }

        if (name === "get_docker_stats") {
            const cmd = `${cmdPrefix}/usr/bin/docker stats --no-stream --format '{{.Name}}:{{.CPUPerc}}:{{.MemPerc}}'`;
            const result = await executeOnNas(cmd);
            const lines = result.trim().split('\n');
            const formatted = lines.map(line => {
                const [n, c, m] = line.split(':');
                return `- **${n}**: CPU: ${c}%, RAM: ${m}%`;
            }).join('\n');

            return { content: [{ type: "text", text: `Docker Container Stats:\n${formatted || "No stats available."}` }] };
        }

        if (name === "get_container_logs") {
            const containerName = args?.containerName;
            const sinceMinutes = args?.sinceMinutes || 10;

            if (containerName) {
                if (!/^[a-zA-Z0-9_.-]+$/.test(containerName)) throw new Error("Invalid container name.");
                const cmd = `${cmdPrefix}/usr/bin/docker logs --since ${sinceMinutes}m ${containerName}`;
                const result = await executeOnNas(cmd);
                return { content: [{ type: "text", text: `Logs for ${containerName} (last ${sinceMinutes}m):\n${result || "No logs."}` }] };
            } else {
                const psCmd = `${cmdPrefix}/usr/bin/docker ps --format "{{.Names}}"`;
                const psResult = await executeOnNas(psCmd);
                const containers = psResult.split('\n').map(c => c.trim()).filter(Boolean);

                if (containers.length === 0) {
                    return { content: [{ type: "text", text: "No active containers found." }] };
                }

                let aggregatedLogs = `Logs for all active containers (last ${sinceMinutes}m):\n\n`;
                for (const c of containers) {
                    try {
                        const logCmd = `${cmdPrefix}/usr/bin/docker logs --since ${sinceMinutes}m ${c}`;
                        const logs = await executeOnNas(logCmd);
                        if (logs) {
                            aggregatedLogs += `--- 🐳 ${c} ---\n${logs}\n\n`;
                        } else {
                            aggregatedLogs += `--- 🐳 ${c} ---\n[No recent logs]\n\n`;
                        }
                    } catch (err: any) {
                        aggregatedLogs += `--- 🐳 ${c} ---\n[Error reading logs]\n\n`;
                    }
                }
                return { content: [{ type: "text", text: aggregatedLogs }] };
            }
        }

        if (name === "manage_native_container") {
            const { name: containerName, action } = args as { name: string; action: string };
            const cmd = `${cmdPrefix}/usr/bin/docker ${action} ${containerName}`;
            await executeOnNas(cmd);
            return {
                content: [{ type: "text", text: `✅ Container **${containerName}** successfully ${action}ed.` }]
            };
        }

        if (name === "list_native_stacks") {
            const cmd = `${cmdPrefix}/usr/bin/docker compose ls --format json`;
            const result = await executeOnNas(cmd).catch(() => "[]");
            let stacks = [];
            try { stacks = JSON.parse(result); } catch (e) { /* fallback to raw if json fails */ }

            if (!Array.isArray(stacks) || stacks.length === 0) {
                // Try raw format if json is not supported or empty
                const rawResult = await executeOnNas(`${cmdPrefix}/usr/bin/docker compose ls`);
                return { content: [{ type: "text", text: `Native Stacks:\n\`\`\`\n${rawResult || "No stacks found."}\n\`\`\`` }] };
            }

            const formatted = stacks.map((s: any) => `- **${s.Name}**: Status: ${s.Status} | Config: ${s.ConfigFiles}`).join('\n');
            return { content: [{ type: "text", text: `Native Stacks:\n${formatted}` }] };
        }

        if (name === "update_native_stack") {
            const { projectName, workingDir } = args as { projectName: string; workingDir: string };

            // Security check: simple path validation (could be more robust)
            if (!workingDir.startsWith("/")) {
                throw new Error("Invalid working directory path. Must be absolute.");
            }

            const pullCmd = `cd ${workingDir} && ${cmdPrefix}/usr/bin/docker compose pull`;
            const upCmd = `cd ${workingDir} && ${cmdPrefix}/usr/bin/docker compose up -d`;

            await executeOnNas(pullCmd);
            await executeOnNas(upCmd);

            return {
                content: [{ type: "text", text: `🚀 Stack **${projectName}** updated successfully (Pull + Up -d in ${workingDir}).` }]
            };
        }

        return null; // Not meant for this module
    }
};

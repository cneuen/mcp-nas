import { McpModule } from "./types.js";

export const omvModule: McpModule = {
    name: "omv",
    async isSupported(executeOnNas) {
        try {
            await executeOnNas("which /usr/sbin/omv-rpc");
            return true;
        } catch {
            return false;
        }
    },
    getTools() {
        return [
            {
                name: "get_system_stats",
                description: "Get general OMV system stats (CPU, RAM, Uptime)",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "check_updates",
                description: "Check for pending APT/OMV system updates",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "get_top_processes",
                description: "List the most resource-intensive processes currently running on the NAS",
                inputSchema: {
                    type: "object",
                    properties: {
                        count: { type: "number", description: "Number of processes to show (default: 10)", default: 10 }
                    }
                },
            },
            {
                name: "check_docker_updates",
                description: "Check for available updates for Docker images via OMV Compose API",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "get_container_info",
                description: "Get detailed information about a Docker container (ID, Version, Stats, Logs)",
                inputSchema: {
                    type: "object",
                    properties: {
                        name: { type: "string", description: "Container name or ID" }
                    },
                    required: ["name"]
                },
            },
            {
                name: "manage_container",
                description: "Start, Stop, or Restart a Docker container",
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
                name: "update_container",
                description: "Pull the latest image and restart (Update) a Docker container",
                inputSchema: {
                    type: "object",
                    properties: {
                        name: { type: "string", description: "Container name" }
                    },
                    required: ["name"]
                },
            },
        ];
    },
    async handleCall(name, args, executeOnNas) {
        const cmdPrefix = "sudo ";
        if (name === "get_system_stats") {
            const cmd = `${cmdPrefix}/usr/sbin/omv-rpc -u admin 'System' 'getInformation' '{}'`;
            const result = await executeOnNas(cmd);
            let data;
            try {
                data = JSON.parse(result);
            } catch (pErr) {
                throw new Error(`Failed to parse OMV response: ${result.substring(0, 100)}...`);
            }

            const loadStr = typeof data.loadAverage === 'object'
                ? `1min: ${data.loadAverage['1min']}, 5min: ${data.loadAverage['5min']}, 15min: ${data.loadAverage['15min']}`
                : data.loadAverage;

            const toGB = (bytes: number) => (bytes / (1024 ** 3)).toFixed(2);
            const ramStr = `${toGB(data.memUsed)} GB used / ${toGB(data.memTotal)} GB total (${(data.memUtilization * 100).toFixed(1)}%)`;
            const updatesStr = data.availablePkgUpdates > 0 ? `${data.availablePkgUpdates} ⚠️` : 'None ✅';

            return {
                content: [
                    {
                        type: "text",
                        text: `System Info for ${data.hostname}:\n- OMV Version: ${data.version}\n- CPU: ${data.cpuModelName} (${data.cpuCores} cores, ${data.cpuUtilization.toFixed(1)}% usage)\n- RAM: ${ramStr}\n- Uptime: ${data.uptime}\n- Load Average: ${loadStr}\n- Pending Updates: ${updatesStr}\n- Reboot Required: ${data.rebootRequired ? 'Yes ⚠️' : 'No'}`,
                    },
                ],
            };
        }


        if (name === "check_updates") {
            // Step 1: Get count via OMV RPC (reliable on OMV 6 & 7)
            const countCmd = `${cmdPrefix}/usr/sbin/omv-rpc -u admin 'System' 'getInformation' '{}'`;
            const countResult = await executeOnNas(countCmd);
            let info;
            try { info = JSON.parse(countResult); } catch (e) { throw new Error(`Parse error: ${countResult.substring(0, 100)}...`); }

            const count = info.availablePkgUpdates || 0;

            if (count === 0) {
                return { content: [{ type: "text", text: "✅ System is fully up to date." }] };
            }

            // Step 2: Get detailed list via apt (universal fallback)
            const listCmd = "apt list --upgradable";
            const listResult = await executeOnNas(listCmd);

            // Clean up apt output (remove WARNING lines and extract package names)
            const lines = listResult.split('\n')
                .filter(line => line.includes('/') && !line.startsWith('Listing'))
                .map(line => line.split('/')[0])
                .slice(0, 20);

            const packageNames = lines.join(', ');
            const suffix = lines.length < count ? '...' : '';

            return {
                content: [{ type: "text", text: `⚠️ ${count} updates available.\nPackages: ${packageNames}${suffix}` }]
            };
        }


        if (name === "get_top_processes") {
            const { count = 10 } = args as { count?: number };
            // Get load average and top processes
            const uptimeRaw = await executeOnNas("uptime");
            const psRaw = await executeOnNas(`ps aux --sort=-%cpu | head -n ${count + 1}`);

            // Format output
            const lines = psRaw.split('\n');
            const header = lines[0];
            const processes = lines.slice(1).join('\n').trim();

            return {
                content: [
                    {
                        type: "text",
                        text: `🚀 System Load & Top Processes:\n${uptimeRaw}\n\nTop ${count} processes by CPU usage:\n\`\`\`\n${header}\n${processes}\n\`\`\``,
                    },
                ],
            };
        }

        if (name === "check_docker_updates") {
            const cmd = `${cmdPrefix}/usr/sbin/omv-rpc -u admin 'Compose' 'getImages' '{}'`;
            const result = await executeOnNas(cmd);
            let data;
            try { data = JSON.parse(result); } catch (e) { throw new Error(`Parse error: ${result.substring(0, 100)}...`); }

            if (!data.data || !Array.isArray(data.data)) {
                return { content: [{ type: "text", text: "No Docker images found." }] };
            }

            const updates = data.data.filter((img: any) => img.status === "AVAILABLE");

            if (updates.length === 0) {
                return { content: [{ type: "text", text: "✅ All Docker images are up to date." }] };
            }

            const formatted = updates.map((img: any) =>
                `- **${img.repo}** (ID: ${img.id.substring(7, 19)}) ⚠️ Update Available`
            ).join('\n');

            return {
                content: [{
                    type: "text",
                    text: `🐳 Docker Image Updates Available:\n${formatted}\n\n*Note: Use 'docker-compose pull' on your NAS to update these images.*`
                }]
            };
        }

        if (name === "get_container_info") {
            const { name: containerName } = args as { name: string };

            // sudoers restriction: We can't use --filter, so we fetch all and filter in JS
            const psRaw = await executeOnNas(`sudo docker ps --format "{{.Names}} | {{.ID}} | {{.Image}} | {{.CreatedAt}} | {{.Status}} | {{.Labels}}"`).catch(() => "");
            const statsRaw = await executeOnNas(`sudo docker stats --no-stream --format "{{.Name}} | {{.CPUPerc}} | {{.MemUsage}}"`).catch(() => "");

            // For logs, sudoers allows --since, so we use that instead of --tail
            const logsInfo = await executeOnNas(`sudo docker logs --since 1h ${containerName} | tail -n 50`).catch(() => "Logs unavailable (or no logs in the last hour)");

            // Manual filtering
            const lines = psRaw.split('\n');
            const psLine = lines.find(l => l.trim().startsWith(`${containerName} |`));
            const statsLine = statsRaw.split('\n').find(l => l.trim().startsWith(`${containerName} |`));

            if (!psLine) {
                return { content: [{ type: "text", text: `❌ Container **${containerName}** not found in production.` }] };
            }

            const psParts = psLine.split('|');
            const psMetadata = psParts.slice(1, 5).join('|').trim();
            const labelsStr = psParts[5] || "";

            // Extract OMV Compose project and service
            const projectMatch = labelsStr.match(/com\.docker\.compose\.project=([^,]+)/);
            const serviceMatch = labelsStr.match(/com\.docker\.compose\.service=([^,]+)/);

            const projectName = projectMatch ? projectMatch[1] : "Unknown (Not OMV-managed?)";
            const serviceName = serviceMatch ? serviceMatch[1] : containerName;

            const statsInfo = statsLine ? statsLine.split('|').slice(1).join('|').trim() : "Stats unavailable";

            return {
                content: [{
                    type: "text",
                    text: `📦 Detailed Info for: **${containerName}**\n\n**Metadata (ID | Image | Created | Status):**\n\`${psMetadata}\`\n\n**OMV Stack (Project):** \`${projectName}\`\n**OMV Service:** \`${serviceName}\`\n\n**Resource Usage (CPU | RAM):**\n\`${statsInfo}\`\n\n**Recent Logs (Last hour, max 50 lines):**\n\`\`\`\n${logsInfo}\n\`\`\``
                }]
            };
        }

        if (name === "manage_container") {
            const { name: containerName, action } = args as { name: string; action: string };
            // OMV 7 doContainerCommand requires 'id' parameter (can be name or short ID)
            const rpcParams = JSON.stringify({ id: containerName, command: action });
            const cmd = `${cmdPrefix}/usr/sbin/omv-rpc -u admin 'Compose' 'doContainerCommand' '${rpcParams}'`;

            await executeOnNas(cmd);
            return {
                content: [{
                    type: "text",
                    text: `✅ Action **${action}** triggered for container **${containerName}** via OMV Compose.`
                }]
            };
        }

        if (name === "update_container") {
            const { name: containerName } = args as { name: string };

            // 1. Identify the PROJECT (stack) name for this container via labels
            const psRaw = await executeOnNas(`sudo docker ps --format "{{.Names}} | {{.Labels}}"`).catch(() => "");
            const psLine = psRaw.split('\n').find(l => l.trim().startsWith(`${containerName} |`));

            if (!psLine) {
                return { content: [{ type: "text", text: `❌ Could not find container **${containerName}** to identify its stack.` }] };
            }

            const labelsStr = psLine.split('|')[1] || "";
            const projectMatch = labelsStr.match(/com\.docker\.compose\.project=([^,]+)/);

            if (!projectMatch) {
                return { content: [{ type: "text", text: `❌ Container **${containerName}** is not managed by OMV Compose (no project label).` }] };
            }

            const projectName = projectMatch[1];

            // 2. Find the UUID of the project in OMV
            // Using search parameter to find the specific project
            const filesRaw = await executeOnNas(`sudo /usr/sbin/omv-rpc -u admin 'Compose' 'getFileList' '{"start":0,"limit":10,"search":"${projectName}"}'`);
            let filesData;
            try {
                filesData = JSON.parse(filesRaw);
            } catch (e) {
                throw new Error(`Failed to parse OMV project list: ${filesRaw}`);
            }

            const project = (filesData.data || []).find((f: any) => f.name === projectName);
            if (!project) {
                return { content: [{ type: "text", text: `❌ Could not find OMV Project named **${projectName}** in the file list.` }] };
            }

            const projectUuid = project.uuid;

            // 3. Perform Pull then Up on the PROJECT stack using the UUID
            // command and command2 are required for docker compose args
            const pullParams = JSON.stringify({ uuid: projectUuid, command: "pull" });
            const upParams = JSON.stringify({ uuid: projectUuid, command: "up", command2: "-d" });

            const pullCmd = `${cmdPrefix}/usr/sbin/omv-rpc -u admin 'Compose' 'doCommand' '${pullParams}'`;
            const upCmd = `${cmdPrefix}/usr/sbin/omv-rpc -u admin 'Compose' 'doCommand' '${upParams}'`;

            await executeOnNas(pullCmd);
            await executeOnNas(upCmd);

            return {
                content: [{
                    type: "text",
                    text: `🚀 Update sequence (Pull + Up -d) triggered for stack **${projectName}** (ID: ${projectUuid}). OMV is now pulling the latest images and restarting the services in the background.`
                }]
            };
        }

        return null; // Not meant for this module
    }
};

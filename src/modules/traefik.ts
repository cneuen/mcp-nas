import { McpModule } from "./types.js";

export const traefikModule: McpModule = {
    name: "traefik",
    async isSupported(executeOnNas) {
        try {
            const containers = await executeOnNas("sudo docker ps --format '{{.Image}}'");
            return containers.includes("traefik");
        } catch {
            return false;
        }
    },
    getTools() {
        return [
            {
                name: "get_traefik_status",
                description: "Get Traefik container status, version, and entrypoints",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "list_traefik_routes",
                description: "Discover all active routes/services managed by Traefik by scanning Docker labels",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "get_traefik_logs",
                description: "Get recent error logs from the Traefik container",
                inputSchema: { type: "object", properties: {} },
            },
        ];
    },
    async handleCall(name, args, executeOnNas) {
        // Find Traefik container name/id first
        const findTraefikCmd = "sudo /usr/bin/docker ps --filter 'ancestor=traefik' --format '{{.Names}}' | head -n 1";
        const traefikName = (await executeOnNas(findTraefikCmd)).trim() || "traefik";

        if (name === "get_traefik_status") {
            const inspectRaw = await executeOnNas(`sudo /usr/bin/docker inspect ${traefikName} --format '{{json .State.Health}} | {{json .Config.Entrypoint}} | {{json .Config.Cmd}}'`);
            const [health, entrypoint, cmd] = inspectRaw.split('|').map(s => s.trim());

            const versionCmd = `sudo /usr/bin/docker exec ${traefikName} traefik version`;
            const version = await executeOnNas(versionCmd).catch(() => "Unknown");

            return {
                content: [{
                    type: "text",
                    text: `Traefik Status (${traefikName}):\n- **Version**: ${version.split('\n')[0]}\n- **Health**: ${health || "Not configured"}\n- **Command**: \`${entrypoint} ${cmd}\``
                }]
            };
        }

        if (name === "get_traefik_logs") {
            const logs = await executeOnNas(`sudo /usr/bin/docker logs --tail 100 ${traefikName} 2>&1 | grep -iE "error|warn" | tail -n 50 || true`);
            return {
                content: [{
                    type: "text",
                    text: `Traefik Error/Warn Logs (Last 50):\n\`\`\`\n${logs || "No recent errors found."}\n\`\`\``
                }]
            };
        }

        if (name === "list_traefik_routes") {
            // Get all containers with their labels
            const cmd = "sudo /usr/bin/docker ps --format '{{.Names}} | {{.Labels}}'";
            const result = await executeOnNas(cmd);
            const lines = result.split('\n');

            const routes: string[] = [];
            lines.forEach(line => {
                const [container, labelsStr] = line.split('|').map(s => s.trim());
                if (!labelsStr) return;

                // Look for Traefik rule label: traefik.http.routers.NAME.rule
                // Matches Host(`domain.tld`)
                const hostMatches = labelsStr.match(/traefik\.http\.routers\.[^.]+\.rule=Host\(`([^`]+)`\)/g);
                if (hostMatches) {
                    hostMatches.forEach(match => {
                        const host = match.match(/Host\(`([^`]+)`\)/)?.[1];
                        const tls = labelsStr.includes(".tls=true") || labelsStr.includes(".tls.certresolver=");
                        routes.push(`- **${container}**: [${tls ? '🔒 https' : '🔓 http'}://${host}](http://${host})`);
                    });
                }
            });

            return {
                content: [{
                    type: "text",
                    text: `Traefik Routed Services (Discovered via Labels):\n${routes.length > 0 ? routes.join('\n') : "No active Traefik routes found on running containers."}`
                }]
            };
        }

        return null;
    }
};

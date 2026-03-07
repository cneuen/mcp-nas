import { McpModule } from "./types.js";

export const crowdsecModule: McpModule = {
    name: "crowdsec",
    async isSupported(executeOnNas) {
        try {
            const cmdPrefix = "sudo ";
            const psCmd = `${cmdPrefix}/usr/bin/docker ps --format "{{.Names}}"`;
            const psResult = await executeOnNas(psCmd);
            const containers = psResult.split('\n').map(c => c.trim()).filter(Boolean);
            const csContainer = containers.find(c => c.toLowerCase().includes('crowdsec'));
            return !!csContainer;
        } catch {
            return false;
        }
    },
    getTools() {
        return [
            {
                name: "get_crowdsec_bans",
                description: `Get active bans from CrowdSec`,
                inputSchema: { type: "object", properties: {} },
            }
        ];
    },
    async handleCall(name, args, executeOnNas) {
        const cmdPrefix = "sudo ";
        if (name === "get_crowdsec_bans") {
            const psCmd = `${cmdPrefix}/usr/bin/docker ps --format "{{.Names}}"`;
            const psResult = await executeOnNas(psCmd);
            const containers = psResult.split('\n').map(c => c.trim()).filter(Boolean);
            const csContainer = containers.find(c => c.toLowerCase().includes('crowdsec'));

            if (!csContainer) {
                return { content: [{ type: "text", text: "CrowdSec container is no longer active." }] };
            }

            const cmd = `${cmdPrefix}/usr/bin/docker exec ${csContainer} cscli decisions list -o json`;
            const result = await executeOnNas(cmd);
            let data;
            try {
                data = result.trim() ? JSON.parse(result) : [];
            } catch (e) {
                throw new Error(`Parse error: ${result.substring(0, 100)}...`);
            }

            if (!Array.isArray(data) || data.length === 0) {
                return { content: [{ type: "text", text: "✅ No active bans in CrowdSec." }] };
            }

            const formatted = data.map((d: any, index: number) => {
                // Determine IP - more robust extraction from Alerts/Decisions
                let ip = "Unknown IP";

                // Priority 1: source.ip or source.value
                if (d.source) {
                    ip = d.source.ip || d.source.value || ip;
                }

                // Priority 2: decision value (if IP is still unknown or looks like UUID)
                if ((ip === "Unknown IP" || ip.length > 20) && d.decisions && d.decisions[0]) {
                    ip = d.decisions[0].value || ip;
                }

                // Priority 3: top-level value (if it doesn't look like a UUID)
                if ((ip === "Unknown IP" || ip.length > 20) && d.value && d.value.length < 20) {
                    ip = d.value;
                }

                if (ip === "Unknown IP" || ip.length > 20) {
                    console.error(`[CrowdSec] Parsing warning: Could not find clear IP in record #${index}. Found: ${ip}. Full record:`, JSON.stringify(d));
                }

                const reason = d.scenario || (d.decisions && d.decisions[0]?.scenario) || "Unknown reason";
                const origin = d.origin || d.source?.origin || d.decisions && d.decisions[0]?.origin || "Unknown origin";
                const duration = d.duration || (d.decisions && d.decisions[0]?.duration) || "Unknown duration";
                return `- **IP**: ${ip} | **Reason**: ${reason} | **Source**: ${origin} | **Expires in**: ${duration}`;
            }).join('\n');

            return { content: [{ type: "text", text: `🛡️ Active CrowdSec Bans (${data.length}):\n${formatted}` }] };
        }
        return null;
    }
};

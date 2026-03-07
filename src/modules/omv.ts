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
                name: "get_storage_stats",
                description: "Get filesystem storage stats (Free/Used space) from OMV",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "check_updates",
                description: "Check for pending APT/OMV system updates",
                inputSchema: { type: "object", properties: {} },
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

            return {
                content: [
                    {
                        type: "text",
                        text: `System Info for ${data.hostname}:\n- OMV Version: ${data.version}\n- CPU: ${data.cpuModelName} (${data.cpuCores} cores, ${data.cpuUtilization.toFixed(1)}% usage)\n- RAM: ${ramStr}\n- Uptime: ${data.uptime}\n- Load Average: ${loadStr}\n- Reboot Required: ${data.rebootRequired ? 'Yes ⚠️' : 'No'}`,
                    },
                ],
            };
        }

        if (name === "get_storage_stats") {
            const cmd = `${cmdPrefix}/usr/sbin/omv-rpc -u admin 'FileSystemMgmt' 'getList' '{"start":0,"limit":100}'`;
            const result = await executeOnNas(cmd);
            let data;
            try { data = JSON.parse(result); } catch (e) { throw new Error(`Parse error: ${result.substring(0, 100)}...`); }

            if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
                return { content: [{ type: "text", text: "No storage devices found." }] };
            }

            const formatted = data.data.map((fs: any) => {
                const status = fs.status === 1 ? 'Online ✅' : 'Offline ❌';
                return `- **${fs.mountpoint || 'Unknown'}** (${fs.devicefile}): ${fs.percentage}% used (${fs.used} / ${fs.size}). Status: ${status}`;
            }).join('\n');

            return { content: [{ type: "text", text: `Storage Status:\n${formatted || "No filesystems."}` }] };
        }

        if (name === "check_updates") {
            const cmd = `${cmdPrefix}/usr/sbin/omv-rpc -u admin 'Apt' 'getUpgraded' '{}'`;
            const result = await executeOnNas(cmd);
            let data;
            try { data = JSON.parse(result); } catch (e) { throw new Error(`Parse error: ${result.substring(0, 100)}...`); }

            if (!data.data || data.data.length === 0) {
                return { content: [{ type: "text", text: "✅ System is fully up to date." }] };
            }
            const count = data.data.length;
            const packageNames = data.data.map((p: any) => p.name).slice(0, 15).join(', ');
            const suffix = count > 15 ? '...' : '';
            return {
                content: [{ type: "text", text: `⚠️ ${count} updates available.\nPackages: ${packageNames}${suffix}` }]
            };
        }
        return null; // Not meant for this module
    }
};

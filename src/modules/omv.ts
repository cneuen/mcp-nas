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
            {
                name: "get_disk_health",
                description: "List all physical disks and their S.M.A.R.T. health status",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "get_disk_details",
                description: "Get detailed S.M.A.R.T. attributes and temperature for a specific disk",
                inputSchema: {
                    type: "object",
                    properties: {
                        device: { type: "string", description: "Device path (e.g., /dev/sda)" }
                    },
                    required: ["device"]
                },
            },
            {
                name: "get_raid_status",
                description: "Get the status of software RAID (mdadm) arrays",
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

        if (name === "get_disk_health") {
            const cmd = `${cmdPrefix}/usr/sbin/omv-rpc -u admin 'Smart' 'enumerateDevices' '{}'`;
            const result = await executeOnNas(cmd);
            let data;
            try { data = JSON.parse(result); } catch (e) { throw new Error(`Parse error: ${result.substring(0, 100)}...`); }

            if (!Array.isArray(data) || data.length === 0) {
                return { content: [{ type: "text", text: "No SMART-capable disks found." }] };
            }

            const formatted = data.map((d: any) => {
                const status = d.overallstatus === "GOOD" ? "✅ Healthy" : `⚠️ ${d.overallstatus}`;
                return `- **${d.devicename}**: ${d.vendor || ''} ${d.description} (S/N: ${d.serialnumber}). Status: ${status}`;
            }).join('\n');

            return { content: [{ type: "text", text: `Physical Disks Health:\n${formatted}` }] };
        }

        if (name === "get_disk_details") {
            const { device } = args as { device: string };
            const cmd = `${cmdPrefix}/usr/sbin/omv-rpc -u admin 'Smart' 'getAttributes' '{"devicefile":"${device}"}'`;
            const result = await executeOnNas(cmd);
            let data;
            try { data = JSON.parse(result); } catch (e) { throw new Error(`Parse error: ${result.substring(0, 100)}...`); }

            if (!Array.isArray(data)) {
                return { content: [{ type: "text", text: `Detailed info unavailable for ${device}.` }] };
            }

            const important = data.filter((a: any) =>
                ["Temperature_Celsius", "Power_On_Hours", "Reallocated_Sector_Ct", "Wear_Leveling_Count"].includes(a.name)
            );

            const details = important.map((a: any) => `- **${a.name}**: ${a.rawvalue} (${a.valuemax} max)`).join('\n');
            const temp = data.find((a: any) => a.name === "Temperature_Celsius")?.rawvalue || "Unknown";

            return {
                content: [{
                    type: "text",
                    text: `SMART Details for ${device} (Temp: ${temp}°C):\n${details || "No critical attributes found."}`
                }]
            };
        }

        if (name === "get_raid_status") {
            // Priority 1: Try /proc/mdstat (safe and universal)
            const mdstat = await executeOnNas("cat /proc/mdstat");

            if (!mdstat.includes("active")) {
                return { content: [{ type: "text", text: "No active RAID arrays detected." }] };
            }

            // Cleanup mdstat output for better readability
            const cleanMdstat = mdstat.split('\n')
                .filter(l => l.length > 0 && !l.startsWith('Personalities'))
                .join('\n');

            return {
                content: [{
                    type: "text",
                    text: `Software RAID Status:\n\`\`\`\n${cleanMdstat}\n\`\`\``
                }]
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


        return null; // Not meant for this module
    }
};

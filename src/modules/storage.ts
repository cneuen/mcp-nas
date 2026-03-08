import { McpModule } from "./types.js";

export const storageModule: McpModule = {
    name: "storage",
    async isSupported(executeOnNas) {
        // Universal tools, assumed supported on Linux
        return true;
    },
    getTools() {
        return [
            {
                name: "get_storage_usage",
                description: "Get disk usage for all mounted filesystems (df -h)",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "get_raid_status",
                description: "Get the status of software RAID (mdadm) arrays using /proc/mdstat",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "get_disk_health",
                description: "Check physical disk health using S.M.A.R.T. (smartctl)",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "get_disk_details",
                description: "Get detailed S.M.A.R.T. attributes for a specific disk",
                inputSchema: {
                    type: "object",
                    properties: {
                        device: { type: "string", description: "Device path (e.g., /dev/sda)" }
                    },
                    required: ["device"]
                },
            },
        ];
    },
    async handleCall(name, args, executeOnNas) {
        const cmdPrefix = "sudo ";

        if (name === "get_storage_usage") {
            const result = await executeOnNas("/bin/df -h --output=source,size,used,avail,pcent,target -x tmpfs -x devtmpfs");
            return {
                content: [{ type: "text", text: `Storage Usage:\n\`\`\`\n${result}\n\`\`\`` }]
            };
        }

        if (name === "get_raid_status") {
            const mdstat = await executeOnNas("cat /proc/mdstat");
            if (!mdstat.includes("active")) {
                return { content: [{ type: "text", text: "No active RAID arrays detected via /proc/mdstat." }] };
            }
            return {
                content: [{ type: "text", text: `Software RAID Status:\n\`\`\`\n${mdstat}\n\`\`\`` }]
            };
        }

        if (name === "get_disk_health") {
            const scan = await executeOnNas(`${cmdPrefix}/usr/sbin/smartctl --scan`);
            const devices = scan.split('\n').filter(l => l.includes('/dev/')).map(l => l.split(' ')[0]);

            if (devices.length === 0) {
                return { content: [{ type: "text", text: "No disks found for SMART monitoring." }] };
            }

            let report = "Physical Disks Health (SMART):\n";
            for (const dev of devices) {
                try {
                    const status = await executeOnNas(`${cmdPrefix}/usr/sbin/smartctl -H ${dev}`);
                    const result = status.includes("PASSED") ? "✅ Healthy (PASSED)" : "⚠️ FAILED or Warning";
                    report += `- **${dev}**: ${result}\n`;
                } catch (e) {
                    report += `- **${dev}**: Unknown / Error reading status\n`;
                }
            }

            return { content: [{ type: "text", text: report }] };
        }

        if (name === "get_disk_details") {
            const { device } = args as { device: string };
            const result = await executeOnNas(`${cmdPrefix}/usr/sbin/smartctl -A ${device}`);
            return {
                content: [{ type: "text", text: `SMART Attributes for ${device}:\n\`\`\`\n${result}\n\`\`\`` }]
            };
        }

        return null;
    }
};

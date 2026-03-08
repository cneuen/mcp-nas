import { McpModule } from "./types.js";

export const networkModule: McpModule = {
    name: "network",
    async isSupported(executeOnNas) {
        try {
            await executeOnNas("which ip");
            return true;
        } catch {
            return false;
        }
    },
    getTools() {
        return [
            {
                name: "get_network_interfaces",
                description: "List all network interfaces, their status, and IP addresses",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "get_network_traffic",
                description: "Get real-time network traffic/throughput (1s sample)",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "get_vpn_status",
                description: "Check status of VPN tunnels (Wireguard, Tailscale, Tun)",
                inputSchema: { type: "object", properties: {} },
            },
        ];
    },
    async handleCall(name, args, executeOnNas) {
        if (name === "get_network_interfaces") {
            const result = await executeOnNas("ip -brief addr show");
            return {
                content: [{ type: "text", text: `Network Interfaces Status:\n\`\`\`\n${result}\n\`\`\`` }]
            };
        }

        if (name === "get_network_traffic") {
            // Read twice with 1s delay to calculate throughput
            const readTraffic = async () => {
                const out = await executeOnNas("cat /proc/net/dev");
                const lines = out.split('\n');
                const stats: Record<string, { rx: number, tx: number }> = {};
                lines.slice(2).forEach(line => {
                    const parts = line.trim().split(/\s+/);
                    if (parts.length > 1) {
                        const iface = parts[0].replace(':', '');
                        stats[iface] = { rx: parseInt(parts[1]), tx: parseInt(parts[9]) };
                    }
                });
                return stats;
            };

            const stats1 = await readTraffic();
            await new Promise(resolve => setTimeout(resolve, 1000));
            const stats2 = await readTraffic();

            const formatted = Object.keys(stats2).map(iface => {
                if (iface === 'lo' || !stats1[iface]) return null;
                const rxRate = (stats2[iface].rx - stats1[iface].rx) / 1024; // KB/s
                const txRate = (stats2[iface].tx - stats1[iface].tx) / 1024; // KB/s
                if (rxRate === 0 && txRate === 0) return null;
                return `- **${iface}**: RX: ${rxRate.toFixed(1)} KB/s | TX: ${txRate.toFixed(1)} KB/s`;
            }).filter(Boolean).join('\n');

            return {
                content: [{ type: "text", text: `Current Network Traffic (per second):\n${formatted || "No active traffic detected."}` }]
            };
        }

        if (name === "get_vpn_status") {
            const ifaces = await executeOnNas("ip -brief addr show");
            const vpnIfaces = ["wg0", "tailscale0", "tun0", "zt"]; // common vpn iface prefixes
            const found = ifaces.split('\n').filter(line =>
                vpnIfaces.some(vpn => line.toLowerCase().includes(vpn))
            );

            if (found.length === 0) {
                return { content: [{ type: "text", text: "No active VPN tunnels detected (Wireguard, Tailscale, or OpenVPN)." }] };
            }

            const formatted = found.map(line => {
                const [name, status, ip] = line.trim().split(/\s+/);
                return `- **${name}**: Status: ${status} | IP: ${ip}`;
            }).join('\n');

            return {
                content: [{ type: "text", text: `VPN Tunnel Status:\n${formatted}` }]
            };
        }

        return null;
    }
};

import { McpModule } from "./types.js";

export const fail2banModule: McpModule = {
    name: "fail2ban",
    async isSupported(executeOnNas) {
        try {
            await executeOnNas("which fail2ban-client");
            return true;
        } catch {
            return false;
        }
    },
    getTools() {
        return [
            {
                name: "list_fail2ban_jails",
                description: "List all active Fail2Ban jails",
                inputSchema: { type: "object", properties: {} },
            },
            {
                name: "get_fail2ban_jail_status",
                description: "Get detailed status of a specific Fail2Ban jail, including banned IPs",
                inputSchema: {
                    type: "object",
                    properties: {
                        jail: {
                            type: "string",
                            description: "The name of the jail (e.g., 'sshd')",
                        },
                    },
                    required: ["jail"],
                },
            },
            {
                name: "unban_ip",
                description: "Unban a specific IP address from a specific Fail2Ban jail",
                inputSchema: {
                    type: "object",
                    properties: {
                        jail: {
                            type: "string",
                            description: "The name of the jail (e.g., 'sshd')",
                        },
                        ip: {
                            type: "string",
                            description: "The IP address to unban",
                        },
                    },
                    required: ["jail", "ip"],
                },
            },
        ];
    },
    async handleCall(name, args, executeOnNas) {
        if (name === "list_fail2ban_jails") {
            const raw = await executeOnNas("sudo fail2ban-client status");
            // Output format example:
            // Status
            // |- Number of jail:      1
            // `- Jail list:   sshd
            const lines = raw.split('\n');
            const jailLine = lines.find(l => l.includes("Jail list:"));
            if (!jailLine) return { content: [{ type: "text", text: "No jails found or unexpected output format." }] };

            const jails = jailLine.split(':')[1].trim().split(',').map(j => j.trim());
            return {
                content: [{
                    type: "text",
                    text: `Active Fail2Ban Jails:\n${jails.map(j => `- ${j}`).join('\n')}`
                }]
            };
        }

        if (name === "get_fail2ban_jail_status") {
            const { jail } = args as { jail: string };
            const raw = await executeOnNas(`sudo fail2ban-client status ${jail}`);
            return {
                content: [{
                    type: "text",
                    text: `Fail2Ban Jail Status (${jail}):\n\`\`\`\n${raw}\n\`\`\``
                }]
            };
        }

        if (name === "unban_ip") {
            const { jail, ip } = args as { jail: string; ip: string };
            const result = await executeOnNas(`sudo fail2ban-client set ${jail} unbanip ${ip}`);
            return {
                content: [{
                    type: "text",
                    text: `Unban IP ${ip} from jail ${jail}: ${result}`
                }]
            };
        }

        return null;
    }
};

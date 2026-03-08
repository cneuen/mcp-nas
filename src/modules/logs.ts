import { McpModule } from "./types.js";

export const logsModule: McpModule = {
    name: "logs",
    async isSupported(executeOnNas) {
        // We assume /var/log exists on any Linux system
        return true;
    },
    getTools() {
        return [
            {
                name: "list_system_logs",
                description: "List available log files in /var/log",
                inputSchema: {
                    type: "object",
                    properties: {
                        recursive: { type: "boolean", description: "Whether to list logs recursively (default: false)", default: false }
                    }
                },
            },
            {
                name: "read_system_log",
                description: "Read the last lines of a specific log file in /var/log",
                inputSchema: {
                    type: "object",
                    properties: {
                        filePath: { type: "string", description: "Path to the log file (e.g., /var/log/syslog)" },
                        lines: { type: "number", description: "Number of lines to read (default: 50)", default: 50 }
                    },
                    required: ["filePath"]
                },
            },
            {
                name: "read_journal",
                description: "Read logs from systemd journal (journalctl)",
                inputSchema: {
                    type: "object",
                    properties: {
                        unit: { type: "string", description: "Filter by specific systemd unit (e.g., docker.service)" },
                        lines: { type: "number", description: "Number of lines to read (default: 50)", default: 50 },
                        priority: { type: "string", description: "Filter by priority (emerg, alert, crit, err, warning, notice, info, debug)" },
                        since: { type: "string", description: "Filter logs since a certain time (e.g., '1h ago', '2024-03-08 10:00:00')" }
                    }
                },
            },
            {
                name: "audit_ssh_access",
                description: "Analyze SSH logs for failed attempts and potential attacks",
                inputSchema: {
                    type: "object",
                    properties: {
                        since: { type: "string", description: "Time period to audit (e.g., '24h ago', '7 days ago')", default: "24h ago" }
                    }
                },
            },
        ];
    },
    async handleCall(name, args, executeOnNas) {
        const cmdPrefix = "sudo ";

        if (name === "list_system_logs") {
            const { recursive = false } = args as { recursive?: boolean };
            const cmd = `${cmdPrefix}/bin/ls -F ${recursive ? "-R " : ""}/var/log`;
            const result = await executeOnNas(cmd);
            return {
                content: [{ type: "text", text: `Available logs in /var/log:\n\`\`\`\n${result}\n\`\`\`` }]
            };
        }

        if (name === "read_system_log") {
            const { filePath, lines = 50 } = args as { filePath: string; lines?: number };

            // Basic security check: ensure the path starts with /var/log
            if (!filePath.startsWith("/var/log")) {
                throw new Error("Access denied: only files in /var/log are accessible.");
            }

            const cmd = `${cmdPrefix}/usr/bin/tail -n ${lines} ${filePath}`;
            const result = await executeOnNas(cmd);
            return {
                content: [{ type: "text", text: `Last ${lines} lines of ${filePath}:\n\`\`\`\n${result}\n\`\`\`` }]
            };
        }

        if (name === "read_journal") {
            const { unit, lines = 50, priority, since } = args as { unit?: string; lines?: number; priority?: string; since?: string };

            let cmd = `${cmdPrefix}/usr/bin/journalctl -n ${lines} --no-pager`;
            if (unit) cmd += ` -u ${unit}`;
            if (priority) cmd += ` -p ${priority}`;
            if (since) cmd += ` --since "${since}"`;

            const result = await executeOnNas(cmd);
            return {
                content: [{ type: "text", text: `Journal logs (last ${lines} lines):\n\`\`\`\n${result}\n\`\`\`` }]
            };
        }

        if (name === "audit_ssh_access") {
            const { since = "24h ago" } = args as { since?: string };

            // 1. Fetch relevant SSH logs from journal
            const cmd = `${cmdPrefix}/usr/bin/journalctl -u ssh --since "${since}" --no-pager`;
            const result = await executeOnNas(cmd);

            if (!result || result.trim() === "-- No entries --") {
                return { content: [{ type: "text", text: `SSH Audit since ${since}: No logs found.` }] };
            }

            const lines = result.split('\n');
            const failedAttempts = lines.filter(l => l.includes("Failed password") || l.includes("Invalid user"));
            const acceptedAttempts = lines.filter(l => l.includes("Accepted"));

            // 2. Extract stats
            const ipCounts: Record<string, number> = {};
            const userCounts: Record<string, number> = {};

            failedAttempts.forEach(line => {
                // Example: Mar 08 09:12:45 nas-home sshd[1234]: Failed password for invalid user admin from 1.2.3.4 port 1234 ssh2
                const ipMatch = line.match(/from ([0-9.]+)/);
                const userMatch = line.match(/for (?:invalid user )?([^ ]+) from/);

                if (ipMatch) {
                    const ip = ipMatch[1];
                    ipCounts[ip] = (ipCounts[ip] || 0) + 1;
                }
                if (userMatch) {
                    const user = userMatch[1];
                    userCounts[user] = (userCounts[user] || 0) + 1;
                }
            });

            const topIps = Object.entries(ipCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([ip, count]) => `- **${ip}**: ${count} attempts`)
                .join('\n');

            const topUsers = Object.entries(userCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([user, count]) => `- **${user}**: ${count} attempts`)
                .join('\n');

            const summary = [
                `🛡️ **SSH Security Audit (last ${since})**`,
                `---`,
                `✅ **Successful logins**: ${acceptedAttempts.length}`,
                `❌ **Failed attempts**: ${failedAttempts.length}`,
                ``,
                `🔥 **Top Malicious IPs**:`,
                topIps || "None detected",
                ``,
                `👤 **Targeted Users**:`,
                topUsers || "None detected",
                ``,
                `*Pro-tip: Use CrowdSec or Fail2Ban to block these IPs permanently.*`
            ].join('\n');

            return {
                content: [{ type: "text", text: summary }]
            };
        }

        return null;
    }
};

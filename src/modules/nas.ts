import { McpModule } from "./types.js";

export const nasModule: McpModule = {
    name: "nas",
    async isSupported() {
        return true; // Core module
    },
    getTools() {
        return [
            {
                name: "get_nas_health_summary",
                description: "Get a comprehensive high-level dashboard of the NAS status (Storage, Containers, Security, System)",
                inputSchema: { type: "object", properties: {} },
            },
        ];
    },
    async handleCall(name, args, executeOnNas) {
        if (name === "get_nas_health_summary") {
            // Aggregated command to get multiple stats in one SSH call with unique markers
            const cmd = `
                echo "[[UPTIME]]"
                uptime -p
                echo "[[LOAD]]"
                cat /proc/loadavg
                echo "[[RAID]]"
                cat /proc/mdstat 2>/dev/null || echo "No RAID"
                echo "[[STORAGE]]"
                df -h --output=source,pcent,target -x tmpfs -x devtmpfs | tail -n +2
                echo "[[DOCKER]]"
                sudo /usr/bin/docker ps --format "{{.Names}} | {{.Status}}" 2>/dev/null || echo "No Docker"
                echo "[[UPDATES]]"
                sudo /usr/sbin/omv-rpc -u admin 'System' 'getInformation' '{}' 2>/dev/null || echo '{"availablePkgUpdates":0}'
                echo "[[SECURITY]]"
                sudo /usr/bin/fail2ban-client status 2>/dev/null | grep "Jail list" || echo "No F2B"
                echo "[[CROWDSEC]]"
                sudo /usr/bin/docker exec crowdsec cscli decisions list -o json 2>/dev/null | grep -c '"id"' || echo "0"
            `;

            const rawOutput = await executeOnNas(cmd);

            // Robust line-by-line parsing
            const sections: Record<string, string> = {};
            let currentSection = "";
            rawOutput.split(/\r?\n/).forEach(line => {
                const markerMatch = line.trim().match(/^\[\[(\w+)\]\]$/);
                if (markerMatch) {
                    currentSection = markerMatch[1];
                    sections[currentSection] = "";
                } else if (currentSection) {
                    sections[currentSection] += (sections[currentSection] ? "\n" : "") + line;
                }
            });

            const getSection = (marker: string) => sections[marker] || "";

            let summary = "🚀 **NAS Health Summary Dashboard**\n\n";

            // 1. System
            const uptime = getSection("UPTIME");
            const loadStr = getSection("LOAD");
            const load = loadStr ? loadStr.split(' ')[0] : "N/A";

            const updatesRaw = getSection("UPDATES");
            let totalUpdates = "0";
            let securityUpdates = "0";
            try {
                const updatesData = JSON.parse(updatesRaw);
                totalUpdates = String(updatesData.availablePkgUpdates || 0);
                // OMV doesn't separately split security in getInformation easily without specialized RPC
            } catch (e) { }

            summary += `### 🐧 System Status\n`;
            summary += `- **Uptime**: ${uptime || "Unknown"}\n`;
            summary += `- **CPU Load**: ${load}\n`;
            summary += `- **Pending Updates**: ${totalUpdates}${parseInt(totalUpdates) > 0 ? " ⚠️" : " ✅"}\n\n`;

            // 2. Storage & RAID
            const raidStr = getSection("RAID");
            const isRaidActive = raidStr.includes("active") || raidStr.includes("UU") || raidStr.includes("raid");
            const raidStatus = isRaidActive ? "✅ Active" : (raidStr.includes("No RAID") ? "None" : "⚠️ Degraded/Unavailable");

            const storageLines = getSection("STORAGE").split('\n').filter(l => l.trim().length > 0);
            let maxUsage = 0;
            storageLines.forEach(l => {
                const match = l.match(/(\d+)%/);
                if (match) maxUsage = Math.max(maxUsage, parseInt(match[1]));
            });

            summary += `### 🗄️ Storage & RAID\n`;
            summary += `- **RAID Health**: ${raidStatus}\n`;
            summary += `- **Highest Disk Usage**: ${maxUsage}% ${maxUsage > 85 ? '🔴' : (maxUsage > 70 ? '🟡' : '🟢')}\n\n`;

            // 3. Containers
            const dockerContent = getSection("DOCKER");
            const dockerLines = dockerContent.split('\n').filter(l => l.trim().length > 0 && l !== "No Docker");

            summary += `### 🐳 Containers\n`;
            if (dockerContent === "No Docker" || (dockerLines.length === 0 && dockerContent.includes("error"))) {
                summary += `- **Status**: Not installed or not running\n`;
            } else {
                const runningCount = dockerLines.length;
                const issues = dockerLines.filter(l => l.toLowerCase().includes("restarting") || l.toLowerCase().includes("exited") || l.toLowerCase().includes("unhealthy"));
                summary += `- **Running**: ${runningCount}\n`;
                if (issues.length > 0) {
                    summary += `- **Issues Observed**: ${issues.length} container(s) ⚠️\n`;
                    issues.forEach(i => summary += `  - ⚠️ ${i.split('|')[0].trim()}\n`);
                } else {
                    summary += `- **Health**: ✅ All healthy\n`;
                }
            }
            summary += `\n`;

            // 4. Security
            const securityStr = getSection("SECURITY");
            const f2b = securityStr.includes("Jail list") ? "Active ✅" : "Not running ⚪";
            const crowdsecCount = getSection("CROWDSEC") || "0";

            summary += `### 🛡️ Security\n`;
            summary += `- **Fail2Ban**: ${f2b}\n`;
            summary += `- **CrowdSec Bans**: ${crowdsecCount} active ${parseInt(crowdsecCount) > 0 ? '🛡️' : '✅'}\n`;

            return {
                content: [{ type: "text", text: summary }]
            };
        }

        return null;
    }
};

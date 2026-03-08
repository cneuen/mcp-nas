# 🛡️ MCP-NAS: AI-Powered Homelab Control

<div align="center">
  <img src="./docs/assets/logo.png" alt="MCP-NAS Logo" width="200"/>
</div>

**Control your Homelab via an AI Assistant with Maximalist Security**

[![MCP-NAS](https://img.shields.io/badge/MCP-Protocol-blue.svg)](https://modelcontextprotocol.io)
[![Status](https://img.shields.io/badge/Status-Beta-blue.svg)]()

The `mcp-nas` agent is an experimental Model Context Protocol (MCP) server. It enables any compatible LLM assistant to interact natively with a Linux/NAS system via SSH for real-time monitoring, Docker management, and security intelligence.

---

## ✨ Philosophy & "Zero-Trust" Security
- **Agentless**: Standard SSH communication.
- **Least Privilege**: Restricted `mcp-agent` user with specific `sudo` whitelist.
- **Strong Auth**: Asymmetric keys (ED25519) only.
- **Hardened Key Usage**: The setup script automatically locks the SSH key (`no-pty`, `no-port-forwarding`) to prevent interactive shell access or tunneling.
- **Audit Logging**: A self-deploying SSH Wrapper intercepts and logs every command executed by the AI agent to the NAS syslog (`/var/log/syslog` or `auth.log`).
- **Data Isolation**: No hardcoded credentials.

> ⚠️ **IMPORTANT SECURITY WARNINGS (Please Read)**
> - **Highly Privileged Agent**: While restricted, the `mcp-agent` has control over Docker. E.g., via `docker compose`, an attacker could mount the host filesystem. **Treat the machine running the MCP client as a Highly Privileged Environment.** If your local workstation is compromised, your NAS is at risk.
> - **No Direct Internet Exposure**: **Never** expose your NAS SSH port (22) directly to the internet. Always use a local network or a secure VPN (Wireguard/Tailscale).
> - **Data Privacy**: Using this MCP server means your system logs (e.g., `/var/log`, `journalctl`) are sent to Anthropic's cloud for AI analysis. Ensure no highly sensitive passwords or API keys are written in plaintext to your logs.

---

## 🚀 Modular Features

The agent is organized into **Core** modules (universal) and **Integration** modules (solution-specific).

### 🐧 Core Linux Features
*Works natively on any standard Linux NAS (Debian, Ubuntu, etc.)*
- **📊 Monitoring**: CPU, RAM, Uptime, Temperatures (CPU/HDD), and real-time Network Traffic.
- **🗄️ Storage**: Universal RAID status (`mdstat`), filesystem usage, and SMART disk health.
- **📜 Logs**: Remote access to `/var/log`, `journalctl`, and SSH login audits.

### 🧩 Integrations & Solutions
*Smart modules that activate when the service is detected.*
- **🐶 OpenMediaVault**: Deep integration with OMV RPC for stack management and updates.
- **🐳 Docker & Compose**: Management for native containers and standalone compose stacks.
- **🚦 Traefik**: Automated discovery of reverse-proxy routes and backend health via labels.
- **🛡️ Security**: CrowdSec ban monitoring, VPN status (Wireguard/Tailscale), and SSH auditing.

---

## 🛠️ Installation & Configuration

### 1. NAS Preparation
Run the setup script securely on your NAS (as root) directly from the repository:
```bash
# Download and execute the setup script
curl -fsSL https://raw.githubusercontent.com/cneuen/mcp-nas/main/setup-mcp-nas.sh -o setup-mcp-nas.sh
chmod +x setup-mcp-nas.sh
sudo ./setup-mcp-nas.sh "mcp-agent" "YOUR_SSH_PUBLIC_KEY"
```

### 2. MCP Client Configuration
Modify your MCP client configuration (e.g. `claude_desktop_config.json`, Cline, etc.):
```json
"mcpServers": {
  "mcp-nas": {
  "command": "npx",
  "args": ["-y", "@cneuen/mcp-nas@latest"],
  "env": {
    "NAS_HOST": "192.168.1.X",
    "NAS_USER": "mcp-agent",
    "NAS_KEY_PATH": "C:/Users/USER/.ssh/id_ed25519"
  }
}
```

---

## 🧭 How to interact with your NAS?
- *"Give me a health report of my NAS."*
- *"What are the active routes on Traefik?"*
- *"Has CrowdSec banned any IPs recently?"*
- *"Update the 'emby' stack."*

---
*Made with ❤️ for Homelab enthusiasts.*

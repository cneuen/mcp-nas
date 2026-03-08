# 🗺️ MCP-NAS Roadmap

This document outlines the planned features, improvements, and future directions for the MCP-NAS project, categorized by their integration level.

## 🐧 Core Linux Features (Native)
*Universal tools available on any standard Linux/NAS distribution.*

### 📊 System & Hardware Monitoring
- [x] **Temperature Sensors**: Monitor CPU and HDD temperatures (via `smartctl`).
- [x] **Process Manager**: List top processes by CPU/RAM.
- [x] **Network Traffic**: Real-time bandwidth monitoring and interface status (v0.7.0).
- [ ] **GPU Status**: Support for NVIDIA/Intel GPU monitoring if available.

### 🏗️ Global Storage & RAID (`storage`)
- [x] **Universal RAID Status**: Monitor software RAID (/proc/mdstat) without OMV dependency (v0.8.0).
- [x] **Storage Usage**: Detailed filesystem usage (df -h) (v0.8.0).
- [x] **Disk Health (SMART)**: Monitor physical disk health and detailed attributes (v0.8.0).
- [ ] **Volume Monitoring**: Track LVM or Docker volume usage.

### � Logging & Auditing
- [x] **System Logs**: Support for listing and reading files in `/var/log` (v0.5.0).
- [x] **Systemd Journal**: Integration with `journalctl` for real-time service logs (v0.5.0).
- [x] **SSH Audit**: Tools to audit failed SSH login attempts (v0.5.0).

---

## 🧩 Integrations & External Solutions
*Modules that activate automatically when specific services are detected.*

### 🐳 Docker & Containers
- **OMV Compose Module (`omv`)**: Deep integration for stacks created via OMV UI.
    - [x] v0.4.0 : Lifecycle (Stats, Logs, Start, Stop, Restart)
    - [x] v0.4.3 : UUID-aware Updates (Pull + Up -d)
- **Raw Docker Module (`docker`)**: Management for native containers (Portainer/CLI).
    - [x] **Image Management**: Check for updates (v0.3.2).
    - [x] **Compose Support**: List and manage native stacks (v0.6.0).
    - [x] **Updates**: Pull & Recreate for native stacks (v0.6.0).
- **Traefik Module (`traefik`)**: Automated discovery for reverse-proxy routing.
    - [x] **Routing Discovery**: Map active routes via Docker labels (v0.9.0).
    - [x] **Health & Logs**: Container status and error monitoring (v0.9.0).

### 🛡️ Security Integrations
- [x] **CrowdSec**: Detection and listing of active bans (v0.2.0).
- [x] **Fail2Ban**: Support for listing and managing Fail2Ban jails (v1.0.0-beta).
- [x] **VPN Monitoring**: Check Wireguard/Tailscale/OpenVPN status (v0.7.0).

---

## ⚙️ Automation & Configuration
- [x] **NAS Health Summary**: Aggregated dashboard tool (v1.0.0-beta).
- [ ] **Scheduled Reports**: Automated NAS health summaries.

## 🛠️ Internal Improvements
- [ ] **Unit Tests**: Add test coverage for modules.
- [ ] **Multi-System Support**: Official support beyond OMV (Generic Debian/Ubuntu).
- [ ] **Better Error Parsing**: More descriptive errors for failed SSH/RPC calls.

---
*Feel free to propose new ideas through [GitHub Issues](https://github.com/cneuen/mcp-nas/issues)!*

# 🗺️ MCP-NAS Roadmap

This document outlines the planned features, improvements, and future directions for the MCP-NAS project.

## 🚀 Upcoming Features

### 🐳 Container Management Architecture
**Two dedicated modules for full coverage:**
1. **OMV Compose Module (`omv`)**: Manages stacks created via the OMV UI (uses OMV RPC, UUIDs, stack-aware `pull`/`up`).
    - [x] v0.4.0 : Container Lifecycle (Stats, Logs, Start, Stop, Restart)
    - [x] v0.4.1 : Detailed Info Fix (sudo compliant)
    - [x] v0.4.3 : Docker Update Fix (Stack targeting, UUID-aware, OMV 7 RPC compliant)
2. **Raw Docker Module (`docker`)**: Manages native containers created via Portainer/CLI.
    - [x] **Image Management**: List images and check for updates (v0.3.2).
    - [ ] **Docker Compose**: List and manage native Docker Compose stacks.
    - [ ] **Raw Container Update**: Pull & Restart for non-OMV containers (requires enhanced `sudoers` privileges).
    - [ ] **Volume Monitoring**: Track volume usage.

### 📊 Advanced System Monitoring & Hardware
- [x] **RAID Monitoring**: Status of RAID arrays (via `mdadm` or OMV API).
- [x] **Detailed HDD Info**: Disk models, serial numbers, and wear levels.
- [x] **Temperature Sensors**: Monitor CPU and HDD temperatures (via `smartctl`).
- [x] **Process Manager**: List top processes by CPU/RAM.
- [ ] **Network Traffic**: Real-time bandwidth monitoring.
- [ ] **GPU Status**: Support for NVIDIA/Intel GPU monitoring if available.

### 🛡️ Security & Access
- [ ] **Fail2Ban**: Support for listing and managing Fail2Ban jails.
- [ ] **SSH Logs**: Tools to audit failed SSH login attempts.
- [ ] **VPN Monitoring**: Check Wireguard/Tailscale/OpenVPN status.

### ⚙️ Automation & Configuration
- [ ] **NAS Health Alerts**: Configurable thresholds for storage/CPU.
- [ ] **Scheduled Reports**: Automated NAS health summaries.

## 🛠️ Internal Improvements
- [ ] **Unit Tests**: Add test coverage for modules.
- [ ] **Multi-System Support**: Official support beyond OMV (Generic Debian/Ubuntu).
- [ ] **Better Error Parsing**: More descriptive errors for failed SSH/RPC calls.

---
*Feel free to propose new ideas through [GitHub Issues](https://github.com/cneuen/mcp-nas/issues)!*

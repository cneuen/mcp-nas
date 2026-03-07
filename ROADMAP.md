# 🗺️ MCP-NAS Roadmap

This document outlines the planned features, improvements, and future directions for the MCP-NAS project.

## 🚀 Upcoming Features

### 🐳 Enhanced Docker Controls
- [ ] **Container Lifecycle**: `start`, `stop`, `restart` tools for containers.
- [ ] **Docker Compose**: List and manage Docker Compose stacks.
- [ ] **Image Management**: List images and prune unused ones.
- [ ] **Volume Monitoring**: Track volume usage.

### 📊 Advanced System Monitoring & Hardware
- [x] **RAID Monitoring**: Status of RAID arrays (via `mdadm` or OMV API).
- [x] **Detailed HDD Info**: Disk models, serial numbers, and wear levels.
- [x] **Temperature Sensors**: Monitor CPU and HDD temperatures (via `smartctl`).
- [ ] **Process Manager**: List top processes by CPU/RAM.
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

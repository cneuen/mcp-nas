# 📔 OMV RPC API Reference (OMV 7)

This document lists the available RPC services found on the local OMV 7 system. Each service corresponds to an `.inc` file in `/usr/share/openmediavault/engined/rpc/`.

## 🛠️ Core Services

| Service | Description | Common Methods (Partial) |
| :--- | :--- | :--- |
| **`Apt`** | Package management | `getUpgraded` (legacy), `setSettings`, `update` |
| **`Config`** | System configuration | `get`, `set`, `apply` |
| **`DiskMgmt`** | Physical disk management | `getList`, `setStandby` |
| **`FileSystemMgmt`** | Filesystem & Mounts | `getList`, `mount`, `umount` |
| **`Network`** | Network interfaces & DNS | `getInformation`, `setInterface` |
| **`Smart`** | S.M.A.R.T. monitoring | `enumerateDevices`, `getAttributes`, `runTest` |
| **`System`** | Global system information | `getInformation`, `reboot`, `shutdown` |
| **`UserMgmt`** | Users and Groups | `getGroupList`, `getUserList` |

## 🧩 Plugin & Extension Services

| Service | Origin | Purpose |
| :--- | :--- | :--- |
| **`Compose`** | Docker Compose Plugin | Manage compose files and stacks |
| **`Cron`** | Core | Scheduled tasks |
| **`Fail2Ban`** | Fail2Ban Plugin | Manage jails and bans |
| **`MdMgmt`** | RAID (mdadm) Plugin | Manage software RAID arrays |
| **`Nut`** | UPS Plugin | UPS monitoring (Network UPS Tools) |
| **`OmvExtras`** | OMV-Extras | Management of extra repositories |

## 🔍 How to Discover Methods
To see all methods for a specific service, you can use the following command template on the NAS:
```bash
# List methods for a specific service (example: Smart)
sudo omv-rpc -u admin 'Smart' 'getMethodList' '{}'
```

---
*This file is a live reference for the `mcp-nas` project.*

---
description: 🛡️ MCP-NAS: Configuration & Déploiement Homelab
---

# 🛡️ MCP-NAS : Guide de Déploiement

Bienvenue dans le workflow de gestion de ton **MCP-NAS Agent**. Ce guide t'accompagne dans l'installation et la maintenance de ton serveur MCP.

---

### 1. Préparation du NAS (Architecture Zero-Trust)
Exécute le script de setup sur ton NAS pour configurer l'utilisateur `mcp-agent` et les permissions sudo restreintes.

// turbo
1. Déployer l'environnement sur le NAS (via SSH) :
   `ssh user@nas "sudo bash -s" < setup-mcp-nas.sh mcp-agent "TON_CLE_PUBLIQUE_SSH"`

---

### 2. Compilation de l'Agent Local
L'agent tourne sur ta machine locale (Windows/Mac) pour piloter Claude.

// turbo
2. Installer les dépendances :
   `npm install`

// turbo
3. Builder le projet :
   `npm run build`

---

### 3. Intégration Claude Desktop
Ajoute le serveur à ta configuration Claude.

4. Ouvre ton fichier `%APPDATA%/Claude/claude_desktop_config.json` et ajoute :
```json
"mcp-nas": {
  "command": "node",
  "args": ["C:/Users/cneue/OneDrive/Documents/Christian/dev/mcp-nas/build/index.js"],
  "env": {
    "NAS_HOST": "TA_IP_NAS",
    "NAS_PORT": "22",
    "NAS_USER": "mcp-agent",
    "NAS_KEY_PATH": "C:/Users/cneue/.ssh/id_ed25519"
  }
}
```

---

### 🚀 Capacités Débloquées
Une fois installé, tu peux demander à Claude :
- "Quel est l'état du stockage sur mon NAS ?"
- "Liste les conteneurs Docker et leur conso CPU"
- "Y a-t-il des alertes CrowdSec ?"
- "Vérifie les mises à jour système"

# MCP-OMV : Gestion Intelligente d'OpenMediaVault & Docker

Ce projet implémente un serveur **MCP (Model Context Protocol)** permettant à un assistant IA (comme Claude) d'interagir directement et en toute sécurité avec un serveur **OpenMediaVault (OMV)** et ses conteneurs Docker.

---

## 🔒 1. Sécurité (Security First)

L'architecture repose sur le principe du **moindre privilège** pour garantir une sécurité maximale, même dans un environnement homelab.

### Architecture sans agent (Agentless)
- Aucune installation logicielle complexe sur le NAS.
- Utilisation du protocole **SSH** standard pour la communication.
- Authentification par **clés asymétriques** (ED25519) exclusivement.

### Isolation & Confinement
- **Utilisateur Dédié** : Création d'un utilisateur `mcp-agent` sans mot de passe et sans accès shell root.
- **Wrapper Script (Whitelist)** : L'agent ne peut pas exécuter de commandes arbitraires. Il a accès à un script unique (`mcp-omv-wrapper`) qui valide chaque action.
- **Sudo Restreint** : Les droits `sudo` sont limités par une règle stricte `/etc/sudoers.d/mcp-agent` pointant vers le wrapper, empêchant toute injection ou dérive.

---

## 🚀 2. Fonctionnalités (Features)

Le serveur MCP-OMV expose plusieurs capacités clés via des "tools" standardisés.

### Monitoring Système OMV
- **`get_system_stats`** : Récupération en temps réel des indicateurs critiques via l'API interne d'OMV (`omv-rpc`).
  - CPU : Modèle précis, nombre de cœurs, charge instantanée.
  - RAM : Utilisation détaillée (Utilisé/Total) formatée en Go.
  - Système : Version d'OMV, Uptime, Load Average (1/5/15 min).
  - Statut : Alerte si un redémarrage est nécessaire.

### Gestion Docker
- **`list_containers`** : Vue d'ensemble de l'état du parc de conteneurs (Noms et Status).
- **`get_docker_stats`** : Monitoring granulaire des performances par conteneur (Consommation CPU et RAM en %).

### Évolutivité
- Le projet est conçu pour être étendu à toutes les fonctionnalités d'OMV (Gestion des disques, SMART, Partages réseau, Plugins) en ajoutant simplement des entrées dans le wrapper et l'API MCP.

---

## ⚙️ 3. Fonctionnement (Operation)

L'interaction est fluide et transparente entre l'utilisateur, l'IA et le NAS.

### Chaîne de Liaison
1. **Utilisateur / Interface** : L'utilisateur pose une question dans son assistant (ex: "Quel conteneur consomme le plus ?").
2. **Client MCP** : L'assistant identifie le besoin d'utiliser un outil et appelle le serveur `mcp-omv` local.
3. **Build Docker Local** : Le serveur s'exécute dans un conteneur Docker local léger, assurant l'indépendance des versions Node.js/TypeScript.
4. **Transport SSH** : Le serveur ouvre un tunnel vers le NAS et appelle le wrapper sécurisé.
5. **Réponse IA** : L'assistant reçoit les données brutes, les analyse et répond de manière naturelle.

---

## 🛠️ Installation Rapide

Ce serveur est conçu pour s'exécuter **nativement via Node.js** sur la machine hôte (là où tourne Claude Desktop), de la même manière que la plupart des outils MCP (`@modelcontextprotocol/server-filesystem`, etc.).
Aucun Docker n'est requis sur le poste client, mais **Node.js doit être installé**.

1. **NAS** : Exécuter `setup-nas-mcp.sh` (en root) pour créer l'environnement sécurisé (`mcp-agent` + wrapper).
2. **Local (Compilation)** : Exécuter `npm install` puis `npm run build` dans le répertoire du projet.
3. **Claude Desktop** : Ajouter la configuration suivante à `claude_desktop_config.json` :

```json
"mcpServers": {
  "mcp-omv": {
    "command": "node",
    "args": [
      "C:/Chemin/Vers/mcp-omv/build/index.js"
    ],
    "env": {
      "NAS_HOST": "192.168.1.27",
      "NAS_PORT": "8822",
      "NAS_USER": "mcp-agent",
      "NAS_KEY_PATH": "C:/Users/cneue/.ssh/id_ed25519"
    }
  }
}
```

*Note : Si le projet est publié sur `npm`, la configuration deviendra simplement `"command": "npx", "args": ["-y", "mcp-omv"]`.*

---
*Ce projet transforme un NAS statique en une infrastructure dynamique et pilotable par la voix ou par texte, tout en maintenant les standards de sécurité les plus élevés.*

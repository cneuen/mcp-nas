# Configuration de Claude Desktop pour MCP-OMV

Pour utiliser ton nouveau serveur MCP dans Claude Desktop, tu dois modifier ton fichier de configuration (`%APPDATA%/Claude/claude_desktop_config.json`).

### Configuration Recommandée (via Docker)

Ajoute ceci dans la section `mcpServers` :

```json
"mcp-omv": {
  "command": "docker",
  "args": [
    "run",
    "-i",
    "--rm",
    "-e", "NAS_HOST=192.168.1.27",
    "-e", "NAS_PORT=8822",
    "-e", "NAS_USER=root",
    "-v", "C:/Users/cneue/.ssh/id_ed25519:/app/id_ed25519:ro",
    "-e", "NAS_KEY_PATH=/app/id_ed25519",
    "mcp-omv:latest"
  ]
}
```

> [!IMPORTANT]
> - Vérifie le chemin de ta clé SSH (`C:/Users/cneue/.ssh/id_rsa`).
> - Assure-toi que Docker Desktop est lancé.

### Ce que Claude pourra faire après redémarrage :
*   "Donne-moi les stats système de mon NAS OMV"
*   "Liste les conteneurs qui tournent sur le NAS"
*   ... et bientôt bien plus !

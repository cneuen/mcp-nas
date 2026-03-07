const { Client } = require('ssh2');
const fs = require('fs');
const conn = new Client();
conn.on('ready', () => {
    // Escape double quotes inside the single-quoted RPC parameter string, exactly as in omv.ts
    const searchParam = "emby";
    // Let's test different formatting:

    // Format 1: No escaping (failed earlier)
    // command: sudo /usr/sbin/omv-rpc -u admin 'Compose' 'getFileList' '{"start":0,"limit":10,"search":"emby"}'

    // Format 2: Escaping inner double quotes
    // const params = JSON.stringify({ start: 0, limit: 10, search: searchParam }).replace(/"/g, '\\"');
    // command: sudo /usr/sbin/omv-rpc -u admin 'Compose' 'getFileList' '{\"start\":0,\"limit\":10,\"search\":\"emby\"}'

    const params = JSON.stringify({ start: 0, limit: 100 });
    const cmd = `sudo /usr/sbin/omv-rpc -u admin 'Compose' 'getFileListSuggest' '${params}'`;

    console.log("Executing:", cmd);
    conn.exec(cmd, (err, stream) => {
        let out = '';
        let errOut = '';
        stream.on('data', d => out += d.toString());
        stream.stderr.on('data', d => errOut += d.toString());
        stream.on('close', (code) => {
            console.log("Code:", code);
            console.log("Out:", out);
            console.log("Err:", errOut);
            conn.end();
        });
    });
}).connect({
    host: '192.168.1.27',
    port: 8822,
    username: 'mcp-agent',
    privateKey: fs.readFileSync('C:/Users/cneue/.ssh/id_ed25519')
});

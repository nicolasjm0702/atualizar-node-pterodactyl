const fs = require("fs");
const axios = require("axios");
const path = require("path");

const envPath = path.resolve(__dirname, ".env");
const envFile = fs.readFileSync(envPath, "utf8");

/** @type {{ TEMPO_ATUALIZACAO: number, DOMINIO: string, TOKEN: string, LOGS: string }} */
const envVars = {};
envFile.split("\n").forEach((line) => {
    const [key, value] = line.split("=");
    envVars[key] = value;
});

async function main() {
    let ultimoIp = "";
    do {
        try {
            const ip = await meuIp(envVars.TEMPO_ATUALIZACAO);
            if (ip !== ultimoIp) {
                await atualizar(ip).then(() =>
                    appendLog(`IP atualizado para ${ip}`)
                );
                ultimoIp = ip;
            }
        } catch (e) {
            appendLog(`Erro ao atualizar IP: ${e}`, "error");
        }
        await new Promise((r) =>
            setTimeout(r, envVars.TEMPO_ATUALIZACAO * 60 * 1000)
        );
    } while (true);
}

async function meuIp() {
    return fetch("https://checkip.amazonaws.com/")
        .then((res) => res.text())
        .then((ip) => ip.trim());
}

/**
 * @param {string} fqdn IP
 * @returns {Promise<unknown>}
 */
async function atualizar(fqdn) {
    if (!fqdn) return new Promise((r) => r());

    const api = axios.create({
        baseURL: `http://${envVars.DOMINIO}`,
        headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            Authorization: `Bearer ${envVars.TOKEN}`,
        },
    });

    let data = await api
        .get("/api/application/nodes/1")
        .then((res) => res.data.attributes);

    data = {
        name: data.name,
        description: data.description,
        location_id: data.location_id,
        fqdn,
        scheme: data.scheme,
        behind_proxy: data.behind_proxy,
        maintenance_mode: data.maintenance_mode,
        memory: data.memory,
        memory_overallocate: data.memory_overallocate,
        disk: data.disk,
        disk_overallocate: data.disk_overallocate,
        upload_size: data.upload_size,
        daemon_sftp: data.daemon_sftp,
        daemon_listen: data.daemon_listen,
    };

    return api
        .patch("/api/application/nodes/1", data)
        .catch((err) =>
            appendLog(`Erro ao atualizar IP ${fqdn}: ${err}`, "error")
        );
}

/**
 * @param {string} log
 * @param { 'debug' | 'error' | 'warn' } tipo
 */
function appendLog(log, tipo = "debug") {
    let prefixo = new Date().toISOString();
    switch (tipo) {
        case "error":
            prefixo += " [ERROR]";
            break;
        case "warn":
            prefixo += " [WARN]";
            break;
        default:
            prefixo += " [DEBUG]";
            break;
    }
    fs.appendFileSync(
        envVars.LOGS ?? "atualizar-node.log",
        `${prefixo} ${log}\n`
    );
}

main().catch((err) => {
    appendLog(err, "error");
    process.exit(1);
});

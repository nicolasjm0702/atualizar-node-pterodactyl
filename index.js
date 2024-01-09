const fs = require("fs");
const axios = require("axios");

const envFile = fs.readFileSync(".env", "utf8");

/** @type {{ TEMPO_ATUALIZACAO: number, DOMINIO: string, TOKEN: string }} */
const envVars = {};
envFile.split("\n").forEach((line) => {
    const [key, value] = line.split("=");
    envVars[key] = value;
});

async function main() {
    let ultimoIp = "";
    do {
        const ip = await meuIp(envVars.TEMPO_ATUALIZACAO);
        if (ip !== ultimoIp) {
            await atualizar(ip).then((res) => console.warn(res));
            ultimoIp = ip;
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
        .catch((err) => console.error(`Erro ao atualizar IP ${fqdn}: ${err}`));
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

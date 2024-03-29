const fs = require("fs");
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
      const ip = await meuIp();
      if (ip !== ultimoIp) {
        await atualizar(ip).then(() => appendLog(`IP atualizado para ${ip}`));
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

  let data = await fetch(`http://${envVars.DOMINIO}/api/application/nodes/1`, {
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${envVars.TOKEN}`,
    },
  })
    .then((res) => res.json())
    .then((res) => res.attributes)
    .catch((err) => appendLog(`Erro ao atualizar IP ${fqdn}: ${err}`, "error"));

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

  return fetch(`http://${envVars.DOMINIO}/api/application/nodes/1`, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${envVars.TOKEN}`,
    },
    body: JSON.stringify(data),
  }).catch((err) => appendLog(`Erro ao atualizar IP ${fqdn}: ${err}`, "error"));
}

/**
 * @param {string} log
 * @param { 'debug' | 'error' | 'warn' } tipo
 */
function appendLog(log, tipo = "debug") {
  console.log(log);
  fs.appendFileSync(
    envVars.LOGS ?? "atualizar-node.log",
    `${new Date().toISOString()} [${tipo.toUpperCase()}] ${log}\n`
  );
}

main().catch((err) => {
  appendLog(err, "error");
  process.exit(1);
});

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import test from "node:test";

const docker = (...args) =>
  execFileSync("docker", args, { encoding: "utf8", timeout: 30_000 }).trim();

test(
  "Caddy serves the built presentation and assets without exposing application or repository routes",
  { timeout: 60_000 },
  async (t) => {
    const html = readFileSync("dist-site/index.html", "utf8");
    const assets = [...html.matchAll(/(?:href|src)="(\/assets\/[^\"]+)"/g)].map(
      (match) => match[1],
    );
    assert.ok(assets.some((asset) => asset.endsWith(".css")));
    assert.ok(assets.some((asset) => asset.endsWith(".svg")));
    const container = docker(
      "run",
      "--detach",
      "--publish",
      "127.0.0.1::8080",
      "--env",
      "FLOWATLAS_SITE_DOMAIN=http://:8080",
      "--mount",
      `type=bind,source=${resolve("deployment/site/Caddyfile.flowatlas")},target=/etc/caddy/Caddyfile,readonly`,
      "--mount",
      `type=bind,source=${resolve("dist-site")},target=/data/flowatlas-public/current,readonly`,
      "caddy:2-alpine",
    );
    t.after(() => docker("rm", "--force", "--volumes", container));
    const address = docker("port", container, "8080/tcp");
    assert.match(address, /^127\.0\.0\.1:\d+$/);
    const request = (path) =>
      fetch(`http://${address}${path}`, { signal: AbortSignal.timeout(2000) });
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        ready = (await request("/")).ok;
      } catch {
        /* Wait for the local Caddy process. */
      }
      if (ready) break;
      await delay(200);
    }
    assert.ok(ready, "candidate Caddy starts");
    const page = await request("/");
    assert.equal(page.status, 200);
    assert.match(page.headers.get("content-type"), /text\/html/);
    assert.equal(page.headers.get("set-cookie"), null);
    assert.match(page.headers.get("content-security-policy"), /default-src 'none'/);
    assert.match(
      page.headers.get("content-security-policy"),
      /font-src https:\/\/fonts.gstatic.com/,
    );
    assert.match(await page.text(), /Voyez ce qui/);
    for (const asset of assets) {
      const response = await request(asset);
      assert.equal(response.status, 200, asset);
      assert.match(
        response.headers.get("content-type"),
        asset.endsWith(".css") ? /text\/css/ : /image\/svg\+xml/,
      );
    }
    for (const path of [
      "/api",
      "/api/health",
      "/.env",
      "/README.md",
      "/.git/config",
      "/assets/missing.css",
      "/unknown",
      "/caddy/certificates",
    ]) {
      assert.equal((await request(path)).status, 404, path);
    }
  },
);

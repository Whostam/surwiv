import fs from "node:fs";
import { promises as fsPromises } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const configPath = path.resolve(repoRoot, "survev-config.hjson");
const testApiKey = "survev-test-api-key";

let createdConfig = false;
let Config: any;
let PrivateRouter: any;
let server: any;
let originalApiKey: string | undefined;

beforeAll(async () => {
    if (!fs.existsSync(configPath)) {
        createdConfig = true;
        const configTemplate = `{
  apiServer: {
    host: "127.0.0.1",
    port: 8000
  },
  regions: {
    local: {
      https: false,
      address: "127.0.0.1:8001",
      l10n: "index-local"
    }
  },
  secrets: {
    SURVEV_API_KEY: "${testApiKey}"
  }
}`;
        await fsPromises.writeFile(configPath, configTemplate, "utf-8");
    }

    ({ Config } = await import(
        pathToFileURL(path.resolve(repoRoot, "server/src/config.ts")).href
    ));
    const serverModule = await import(
        pathToFileURL(path.resolve(repoRoot, "server/src/api/apiServer.ts")).href
    );
    server = serverModule.server;
    const privateModule = await import(
        pathToFileURL(
            path.resolve(repoRoot, "server/src/api/routes/private/private.ts"),
        ).href
    );
    PrivateRouter = privateModule.PrivateRouter;

    originalApiKey = Config.secrets.SURVEV_API_KEY;
    Config.secrets.SURVEV_API_KEY = testApiKey;
});

afterAll(async () => {
    Config.secrets.SURVEV_API_KEY = originalApiKey;

    if (createdConfig) {
        await fsPromises.rm(configPath);
    }
});

describe("private API bootstrap", () => {
    it("rejects requests that omit the API key", async () => {
        const response = await PrivateRouter.request("http://local/update_region", {
            method: "POST",
            headers: {
                "content-type": "application/json",
            },
            body: JSON.stringify({
                regionId: "local",
                data: { playerCount: 12 },
            }),
        });

        expect(response.status).toBe(403);
        const body = await response.json();
        expect(body).toEqual({ error: "Forbidden" });
    });

    it("updates region data when provided a valid API key", async () => {
        const response = await PrivateRouter.request("http://local/update_region", {
            method: "POST",
            headers: {
                "content-type": "application/json",
                "survev-api-key": testApiKey,
            },
            body: JSON.stringify({
                regionId: "local",
                data: { playerCount: 42 },
            }),
        });

        expect(response.status).toBe(200);
        const payload = await response.json();
        expect(payload).toEqual({});
        expect(server.regions.local.playerCount).toBe(42);
    });
});

import { ChromaClient, type Collection } from "chromadb";
import { LLM } from "../llm/llm";
import { Logger } from "../logger/logger";

const COLLECTION_NAME = "silicon_seeds";

type ChromaInput = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  prompt: string;
  filename: string;
  filetype: string;
  resolution?: string;
  style?: string;
};

type ChromaStoredMeta = {
  title: string;
  description: string;
  tags: string;
  prompt: string;
  filename: string;
  filetype: string;
  resolution: string;
  style: string;
};

export namespace Chroma {
  let client: ChromaClient;
  let collection: Collection;

  let initPromise: Promise<void> | null = null;

  async function init() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
      const port = Number(Bun.env.CHROMADB_PORT ?? 8000);
      if (!Number.isFinite(port)) {
        throw new Error(`Invalid CHROMADB_PORT: ${Bun.env.CHROMADB_PORT}`);
      }
      // Try hosts in order: CHROMADB_HOST -> 127.0.0.1 -> localhost
      // Server started via `bun run db:chroma` now binds 0.0.0.0, but
      // older default was localhost (::1 only). Try both to stay compatible.
      const primaryHost = Bun.env.CHROMADB_HOST ?? "localhost";
      const hosts = [...new Set([primaryHost, "127.0.0.1", "localhost"])];
      let lastError: unknown;
      for (const host of hosts) {
        client = new ChromaClient({ host, port });
        try {
          await client.heartbeat();
          collection = await client.getOrCreateCollection({
            name: COLLECTION_NAME,
          });
          Logger.info("ChromaDB ready", {
            collection: COLLECTION_NAME,
            host,
            port,
          });
          return;
        } catch (e) {
          lastError = e;
          Logger.warn(
            `Chroma heartbeat failed on ${host}:${port}, trying next`,
            {
              error: e instanceof Error ? e.message : String(e),
            },
          );
        }
      }
      Logger.error(
        "ChromaDB healthcheck failed — is the server running on i.e. port 8000?",
        {
          hosts,
          port,
          error:
            lastError instanceof Error ? lastError.message : String(lastError),
        },
      );
      throw lastError;
    })();
    try {
      await initPromise;
    } catch (e) {
      initPromise = null;
      throw e;
    }
  }

  function isReady() {
    return !!(client && collection);
  }

  function mapMetaToChroma(meta: ChromaInput): {
    metadata: ChromaStoredMeta;
    document: string;
  } {
    return {
      metadata: {
        title: meta.title ?? "",
        description: meta.description ?? "",
        tags: (meta.tags ?? []).join(", "),
        prompt: meta.prompt ?? "",
        filename: meta.filename ?? "",
        filetype: meta.filetype ?? "",
        resolution: meta.resolution ?? "",
        style: meta.style ?? "",
      },
      document: [
        meta.title,
        meta.description,
        `Tags: ${(meta.tags ?? []).join(", ")}`,
      ]
        .filter(Boolean)
        .join(". "),
    };
  }

  export async function exists(id: string): Promise<boolean> {
    if (!isReady()) await init();
    const result = await collection.get({ ids: [id] });
    return result.ids.length > 0;
  }

  export async function saveEmbedding(meta: ChromaInput) {
    if (!isReady()) await init();

    const { metadata, document } = mapMetaToChroma(meta);

    const embedding = await LLM.generateEmbedding(document);

    await collection.upsert({
      ids: [meta.id],
      embeddings: [embedding],
      metadatas: [metadata],
      documents: [document],
    });

    Logger.info("Embedding saved to ChromaDB", { id: meta.id });
  }
}

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

  async function init() {
    const port = Number(Bun.env.CHROMADB_PORT);
    client = new ChromaClient({ port });
    try {
      await client.heartbeat();
    } catch (e) {
      Logger.error(
        "ChromaDB healthcheck failed — is the server running on i.e. port 8000?",
        { error: e instanceof Error ? e.message : String(e) },
      );
      process.exit(1);
    }
    collection = await client.getOrCreateCollection({ name: COLLECTION_NAME });
    Logger.info("ChromaDB ready", { collection: COLLECTION_NAME });
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

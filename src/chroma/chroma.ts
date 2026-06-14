import { ChromaClient, type Collection } from "chromadb";
import { LLM } from "../llm/llm";
import { Logger } from "../logger/logger";

const COLLECTION_NAME = "asset_embeddings";

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
    client = new ChromaClient();
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
      document: [meta.title, meta.description, `Tags: ${(meta.tags ?? []).join(", ")}`]
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

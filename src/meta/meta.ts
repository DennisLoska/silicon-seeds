export namespace Metadata {
  export const clientId = Bun.randomUUIDv7();

  export function randomId() {
    return Bun.randomUUIDv7();
  }
}

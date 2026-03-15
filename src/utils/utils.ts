import nodeAssert from "node:assert";

export namespace Utils {
  export function assert(value: unknown, message: string): asserts value {
    nodeAssert(value, message);
  }
}

/// <reference types="vite/client" />

declare class EdgeKV {
  constructor(options: { namespace: string });
  get(key: string, options?: { type?: 'json' | 'arrayBuffer' | 'stream' }): Promise<string | object | ArrayBuffer | ReadableStream | undefined>;
  put(key: string, value: string | ArrayBuffer | ReadableStream): Promise<void>;
  delete(key: string): Promise<boolean>;
}

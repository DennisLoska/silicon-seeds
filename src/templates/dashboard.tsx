import { Child } from "hono/jsx";

export const dashboard = () => (
  <div className="flex flex-col items-center justify-center min-h-[400px]">
    <h1 className="text-3xl font-bold mb-4">Hello World</h1>
    <p className="text-base-content/60">Welcome to the Dashboard</p>
  </div>
);

import "typed-htmx";

// Hono x HTMX let's go!
declare module "hono/jsx" {
  namespace JSX {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface HTMLAttributes extends HtmxAttributes {}
  }
}

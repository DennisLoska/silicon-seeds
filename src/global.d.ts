import "typed-htmx";

// Hono x HTMX let's go!
declare module "hono/jsx" {
  namespace JSX {
    interface HTMLAttributes extends HtmxAttributes {}
  }
}

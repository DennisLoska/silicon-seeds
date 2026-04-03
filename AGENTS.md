# Instructions

# Project Overview

This project uses the following technologies:

- Bun
- Websockets
- SQLite with Kysely
- Daisy UI for frontend components and styles
- HTMX using SSE (server-sent-events) for API integration


## Use the following skills

Always use the Bun or LM Studio skill when the request is about Bun or working with LLMs locally.
Assume that the knowledge you already have is not uptodate so you should always refer to the skills.

Always use the kysely skill when working with SQL or database queries.
Always use the daisy-ui skill when working with the frontend, HTML, CSS or UI.

# Development

Start the server in hot reload mode:

`bun start:hot`

Verify the server's response using `curl`. Here is an example url:

http://localhost:3000/?job_id=019d4556-bbe7-7000-88da-b48bf06182dc&tab=status

# Documentation

Always read the project's readme to understand the architecture:

~/work/silicon-seeds/README.md

Always read and refer to the following files when the user wants to use one of the specific
technologies:

Bun:

~/work/silicon-seeds/docs/bun.md

Daisy UI:

~/work/silicon-seeds/docs/daisyui.md

Kysely: 

~/work/silicon-seeds/docs/daisyui.md

LM Studio:

~/work/silicon-seeds/docs/lm-studio.md

HTMX: 

For HTMX you have to refer to the documentation online:

https://htmx.org/docs/

## ADDED Requirements

### Requirement: LM Studio client supports text-only chat completions
The LmStudioClient class SHALL provide a method to send text-only prompts to the LM Studio /v1/chat/completions endpoint and receive typed JSON responses.

#### Scenario: Send text prompt with default model
- **WHEN** caller invokes `client.chat({ messages: [{ role: "user", content: "Generate an image prompt" }] })` without specifying a model
- **THEN** the client SHALL send a POST request to http://localhost:1234/v1/chat/completions with the configured default model and return parsed JSON response

#### Scenario: Send text prompt with custom model
- **WHEN** caller invokes `client.chat({ messages: [...], model: "custom-model" })` with a custom model string
- **THEN** the client SHALL use the specified model in the request instead of the default

### Requirement: LM Studio client supports multimodal chat completions with base64 images
The LmStudioClient class SHALL provide a method to send prompts with optional base64-encoded images for vision tasks.

#### Scenario: Send prompt with base64 image
- **WHEN** caller invokes `client.chat({ messages: [{ role: "user", content: "Analyze this" }], images: [base64String] })` with an image
- **THEN** the client SHALL convert the base64 string to a data URL format and include it in the request as an image_url object

#### Scenario: Send prompt without image (text-only mode)
- **WHEN** caller invokes `client.chat({ messages: [...] })` without providing images
- **THEN** the client SHALL send only text content in the message array (no image_url objects)

### Requirement: LM Studio client accepts configuration at construction
The LmStudioClient constructor SHALL accept a configuration object with URL and model settings.

#### Scenario: Client initialized with custom URL and default model
- **WHEN** caller creates `new LmStudioClient({ url: "http://custom:1234" })`
- **THEN** the client SHALL use the provided URL for all requests and fall back to a default model

### Requirement: LM Studio client returns typed response objects
The chat method SHALL return a strongly-typed response object containing the model's reply.

#### Scenario: Receive JSON response from LM Studio
- **WHEN** LM Studio returns a JSON-formatted response with content field
- **THEN** the client SHALL parse and return an object with `content` property typed as string

### Requirement: LM Studio client handles request errors gracefully
The LmStudioClient SHALL throw descriptive errors when API requests fail.

#### Scenario: Connection refused to LM Studio
- **WHEN** the client attempts a request but cannot connect to the server
- **THEN** the client SHALL throw an error with a message indicating connection failure

#### Scenario: Invalid JSON response from LM Studio
- **WHEN** LM Studio returns non-JSON content
- **THEN** the client SHALL throw an error indicating the response could not be parsed
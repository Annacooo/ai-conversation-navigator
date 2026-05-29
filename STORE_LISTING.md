# Store Listing Draft

## Extension name

AI Conversation Navigator

## Short description

Export AI conversations and jump between questions on common AI chat pages.

## Full description

AI Conversation Navigator adds a compact vertical toolbar to supported AI chat pages. It helps you jump between questions, open a scrollable question list, and export conversation content as Markdown, JSON, or TXT.

Features:

- Jump to previous or next question.
- Open a scrollable list of discovered questions.
- Export all Q&A, only questions, or only answers.
- Drag and collapse the floating toolbar.
- Supports Chinese and English browser languages.
- Runs locally in your browser.

Privacy:

The extension reads conversation text from the current page only to provide local navigation and export. It does not upload conversation data, does not make network requests, and does not collect analytics.

## Single purpose

Help users navigate and export AI chat conversations locally in the browser.

## Permission justification

The extension uses a content script on HTTPS pages so it can support multiple AI chat tools. The toolbar is only shown on common AI chat sites or when a chat-like message structure is detected. Page text is processed locally for navigation and export.

## Remote code declaration

No remote code is used.

## Data use declaration

The extension does not collect, transmit, sell, or share user data. Conversation text is processed locally in the browser only when the user opens an AI chat page and uses navigation or export.

## Review notes

To test:

1. Load the unpacked extension.
2. Open a supported AI chat page, such as ChatGPT.
3. Open a conversation with multiple user questions.
4. Use the floating toolbar to jump between questions.
5. Click Export and download Markdown, JSON, or TXT.

The extension intentionally requests broad HTTPS content-script access to support multiple AI chat tools. It does not make network requests.

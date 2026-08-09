- remove images, description param handling and everything regarding image and description update
- make the validate.js script part of the daily run to check for error continously
- make queue 4 stages: cache -> pub -> convert(to unas xml) -> update(send to unas)

- magictools bug found needs fix, but changed direction of what stocksprite should 
    do, so the bugfix will be a strategic refactor.
- make storesprite an incremental product, so from start we can use and test it,
    no need to wait long time before something is ready
- stocksprite is fully automated, no user action is required, create a separate 
    ui for configuration settings
- storeprice is agentic, requires user approval



# StockSprite
- feel like recurring unas updates should be andled in a separate service like stock updates
- using stocksprite to updates tock daily and addin the functionality to update the description 
    or images in the same service is an overkill, because image or description update is rare.
- remove entierly the image/description param handling
- remove the stocksprite-param from unas webshop
- stocksprite should only update stock values, not images or description (this should be handled by StoreSprite)
- separate the `update-webshop` into a new queue (find a better name for these processes):
    - cache: downloads and caches unas webshop data and puts into a local database
    - publish: reads stock data from external csv puts the data into the 'convert' queue
    - convert: converts the published data, checks if update is needed (based on the cached products) 
        on a specific product converts the product into unas xml and puts into an 'update' queue
    - update: reads data from the 'update' queue and sends the updated products to unas
    - stock update workflow: cahce -> publish -> convert -> update
    - create a UI where the mapping for the external warehouse/unas json can be created easily that producec the mapping json
    - stocksprite should read external warehouse stock data from a csv file accessed over http
        csv file is needed so multiple external datasources can export into this file making
        possible to process from any kind of external source. stocksprite can pull in csv from http servers only.
        if someone cannot publish csv over http that needs to be custom handled.

# StoreSprite
Traditional admin panels force users to navigate deep menus and memorize complex 
workflows just to perform basic tasks. This "manual labor" approach is being replaced 
by Intent-Based Management, where you simply tell the AI what you want to achieve. 
Instead of clicking through dozens of screens, you can update stock or adjust prices 
through a single conversation. An agentic UI like StoreSprite acts as a proactive 
partner, finding errors and suggesting improvements before you even notice them. It 
shifts your role from a technical operator to a high-level decision-maker. By removing 
the learning curve, it empowers non-technical owners to run a professional shop without 
outside help. Ultimately, the future of e-commerce isn't about better menus—it’s about 
having a system that understands your goals and executes them for you.

StoreSprite is an AI-powered interface designed to simplify UNAS webshop management. 
It removes the technical complexity of the native UNAS admin page, allowing 
non-technical owners to manage products and understand their site’s performance 
without hiring a specialist. Beyond simple management, StoreSprite proactively provides 
insights, identifies errors, and automatically fixes issues to keep your store running 
smoothly.

## StoreSprite: AI-Powered UNAS Management

### Core Features
- AI Chat (Agentic Support): Ask natural questions about your shop, such as "Which products are running out of stock?"
- Automated Audits: Automatically detects typos, incorrect descriptions, or products assigned to the wrong categories.
- Price Intelligence: Compares your prices with competitors and suggests adjustments to stay competitive.
- Bulk Updates: Apply price changes to entire groups of products instantly after your approval.

### Technical Roadmap
- Connectivity: Build a Model Context Protocol (MCP) server to bridge the UNAS API with AI models.
- Intelligence: Initially use hosted LLMs (Claude, Google AI Studio, or Grok) for fast development; 
    transition to local LLMs later to eliminate API costs.
- Infrastructure: Develop a dedicated backend to manage the MCP server and user sessions.

### The Architecture
The data flows as follows:
User Interface -> Back-end -> LLM -> MCP Server -> UNAS API

### Strategic Solutions & Safeguards
- Massive Updates: Use asynchronous batch processing. Instead of updating all at once, 
    the system queues tasks and updates images/data in the background to avoid API timeouts.
- Price Safety: Implement a "Human-in-the-Loop" requirement. The AI can never change a 
    price without a digital signature or "Approve" click from the user.
- Reversibility: Maintain a Version History (Snapshot). Before any change is made, the 
    system saves the previous state, allowing a "One-Click Undo" if the result isn't 
    as expected.
- Scalability: Use a Microservices approach. By keeping the MCP server and the UI 
    separate, you can launch with simple "Read-only" features first and add "Write" 
    capabilities later.

## Questions
Should StockSprite part of the StoreSprite product?

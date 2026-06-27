# n8n-nodes-datatable-variables

This is an n8n community node package that enables users to create local tables and store variables within them. It runs entirely locally on your host or container, without requiring any external database servers or cloud service setups. 

With this node, you can easily cache, share, and persist variables between workflow runs, execution iterations, or different paths in a workflow.

---

## Key Features

- **Local Storage**: Persists data inside `~/.n8n/n8n-nodes-datatable-variables.json`.
- **Concurrency & Thread Safety**: Uses a self-healing `.lock` file (with PID tracking and a 5-second automatic expiration timeout) and atomic file writes (via temporary file swap) to ensure data safety when multiple executions modify tables simultaneously.
- **Rich Data Types Support**: Supports Text, Numbers, Booleans, Dates, parsed JSON objects, and Binary files.
- **Change Log Polling Trigger**: A trigger node that watches for table updates and fires workflows based on changes (for all variables, a specific key, or multiple keys).
- **Import/Export**: Easily backup or restore tables as binary JSON files or raw JSON objects.

---

## Directory Structure

```text
n8n-nodes-datatable-variables/
├── icons/
│   ├── datatable.svg                  # Icon for the main node
│   ├── datatable-trigger.svg          # Icon for the trigger node
│   └── datatable-import-export.svg    # Icon for the import/export node
├── nodes/
│   └── DatatableVariables/
│       ├── db.ts                      # Local database driver (locks, writes, changes)
│       ├── DatatableVariables.node.ts # Main node logic (CRUD operations)
│       ├── DatatableVariablesTrigger.node.ts # Polling trigger node
│       └── DatatableVariablesImportExport.node.ts # Data backup and restore node
├── package.json                       # Package configurations and scripts
└── tsconfig.json                      # TypeScript configuration
```

---

## Available Nodes & Operations

### 1. Datatable Variables (Main Node)

Acts as a local key-value datatable store.

#### Resource: Variable
- **Set**: Save or update a variable.
  - Supports inline table creation if the table doesn't exist yet via `[+ Create New Table...]`.
  - Type-safe inputs: Text, Number, Boolean, JSON, Date, and Binary files (binary files are read from the incoming item and stored inside the database as Base64 strings along with filename and mimeType).
- **Get**: Load a variable from a table.
  - If it is a binary file, it will reconstruct the file buffer and output it as a binary property on the n8n execution item.
- **Delete**: Delete a variable key from a table.
- **Get All**: Retrieve all variables in a table as a key-value object (binary files return file metadata).

#### Resource: Table
- **List**: List all tables in your local database along with their variable count.
- **Delete**: Delete a table and all variables within it.

---

### 2. Datatable Variables Trigger

Polls the local database change-log and triggers workflows when updates occur.

- **Table Name**: Choose which table to watch.
- **Trigger On**:
  - `All Changes in the Table`: Fires on any variable insert, update, or deletion.
  - `Specific Variable`: Fires only when a specific key is updated.
  - `Multiple Variables`: Fires when any key in a defined list is updated.
- **State Tracking**: Uses n8n workflow static data (`node` scope) to track the processed change IDs. It automatically initializes to the latest change ID when activated, ensuring that workflows only fire on new changes.

---

### 3. Datatable Variables Import/Export

Lets you download or restore your datatable variables easily.

- **Export**: Export a single table or all tables. Output format can be:
  - `JSON File (Binary)`: Generates a downloadable `.json` file.
  - `JSON Output`: Outputs the raw JSON structure directly on the execution node.
- **Import**: Reads a backup file or a raw JSON string.
  - **Modes**: Choose `Merge` (insert/overwrite keys) or `Replace` (wipes the database first and loads the new content).

---

## Installation

### Community Node Install (Standard)

Refer to the official [n8n Community Nodes Installation Guide](https://docs.n8n.io/integrations/community-nodes/installation/) to install this package in your n8n instance using:

```text
n8n-nodes-datatable-variables
```

### Local Development Setup

To link and run this node locally for testing:

1. **Build & Link the Node**:
   ```bash
   cd /path/to/n8n-nodes-datatable-variables
   npm install
   npm run build
   npm link
   ```

2. **Mount in your local n8n installation**:
   Navigate to your local n8n folder (usually `~/.n8n/`):
   ```bash
   cd ~/.n8n
   mkdir nodes
   cd nodes
   npm link n8n-nodes-datatable-variables
   ```

3. **Restart n8n**:
   Restart your n8n server, and the new nodes will appear in your workflow editor.

---

## License

[MIT](LICENSE.md)

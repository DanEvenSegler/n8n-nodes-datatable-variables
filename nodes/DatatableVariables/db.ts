import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface VariableData {
	value: any;
	type: 'text' | 'number' | 'boolean' | 'json' | 'date' | 'binary';
	updatedAt: string;
	mimeType?: string;
	fileName?: string;
}

export interface TableData {
	[key: string]: VariableData;
}

export interface ChangeRecord {
	id: number;
	tableName: string;
	key: string;
	action: 'set' | 'delete' | 'deleteTable';
	value?: any;
	type?: string;
	timestamp: number;
}

export interface DatabaseSchema {
	tables: {
		[tableName: string]: TableData;
	};
	changes: ChangeRecord[];
}

export class DbManager {
	private dbPath: string;
	private lockPath: string;

	constructor() {
		const n8nDir = path.join(os.homedir(), '.n8n');
		if (!fs.existsSync(n8nDir)) {
			fs.mkdirSync(n8nDir, { recursive: true });
		}
		this.dbPath = path.join(n8nDir, 'n8n-nodes-datatable-variables.json');
		this.lockPath = path.join(n8nDir, 'n8n-nodes-datatable-variables.lock');
	}

	private async acquireLock(retries = 100, delay = 50): Promise<boolean> {
		for (let i = 0; i < retries; i++) {
			try {
				// Self-healing: if lock is older than 5 seconds, delete it
				if (fs.existsSync(this.lockPath)) {
					try {
						const stats = fs.statSync(this.lockPath);
						if (Date.now() - stats.mtimeMs > 5000) {
							fs.unlinkSync(this.lockPath);
						}
					} catch (err) {}
				}
				fs.writeFileSync(this.lockPath, process.pid.toString(), { flag: 'wx' });
				return true;
			} catch (err) {
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}
		return false;
	}

	private releaseLock(): void {
		try {
			if (fs.existsSync(this.lockPath)) {
				fs.unlinkSync(this.lockPath);
			}
		} catch (err) {}
	}

	private readDb(): DatabaseSchema {
		try {
			if (!fs.existsSync(this.dbPath)) {
				return { tables: {}, changes: [] };
			}
			const content = fs.readFileSync(this.dbPath, 'utf8');
			if (!content.trim()) {
				return { tables: {}, changes: [] };
			}
			return JSON.parse(content);
		} catch (err) {
			return { tables: {}, changes: [] };
		}
	}

	private writeDb(db: DatabaseSchema): void {
		const tempPath = this.dbPath + '.tmp';
		fs.writeFileSync(tempPath, JSON.stringify(db, null, 2), 'utf8');
		fs.renameSync(tempPath, this.dbPath);
	}

	public async getTables(): Promise<string[]> {
		const locked = await this.acquireLock();
		try {
			const db = this.readDb();
			return Object.keys(db.tables);
		} finally {
			if (locked) this.releaseLock();
		}
	}

	public async createTable(tableName: string): Promise<void> {
		const locked = await this.acquireLock();
		try {
			const db = this.readDb();
			if (!db.tables[tableName]) {
				db.tables[tableName] = {};
				this.writeDb(db);
			}
		} finally {
			if (locked) this.releaseLock();
		}
	}

	public async deleteTable(tableName: string): Promise<void> {
		const locked = await this.acquireLock();
		try {
			const db = this.readDb();
			if (db.tables[tableName]) {
				delete db.tables[tableName];
				this.addChange(db, tableName, '*', 'deleteTable');
				this.writeDb(db);
			}
		} finally {
			if (locked) this.releaseLock();
		}
	}

	public async getVariables(tableName: string): Promise<TableData | null> {
		const locked = await this.acquireLock();
		try {
			const db = this.readDb();
			return db.tables[tableName] || null;
		} finally {
			if (locked) this.releaseLock();
		}
	}

	public async getVariable(tableName: string, key: string): Promise<VariableData | null> {
		const locked = await this.acquireLock();
		try {
			const db = this.readDb();
			if (!db.tables[tableName]) return null;
			return db.tables[tableName][key] || null;
		} finally {
			if (locked) this.releaseLock();
		}
	}

	public async setVariable(
		tableName: string,
		key: string,
		value: any,
		type: VariableData['type'],
		mimeType?: string,
		fileName?: string
	): Promise<VariableData> {
		const locked = await this.acquireLock();
		try {
			const db = this.readDb();
			if (!db.tables[tableName]) {
				db.tables[tableName] = {};
			}

			const varData: VariableData = {
				value,
				type,
				updatedAt: new Date().toISOString(),
			};
			if (mimeType) varData.mimeType = mimeType;
			if (fileName) varData.fileName = fileName;

			db.tables[tableName][key] = varData;

			this.addChange(db, tableName, key, 'set', value, type);
			this.writeDb(db);
			return varData;
		} finally {
			if (locked) this.releaseLock();
		}
	}

	public async deleteVariable(tableName: string, key: string): Promise<boolean> {
		const locked = await this.acquireLock();
		try {
			const db = this.readDb();
			if (!db.tables[tableName] || !db.tables[tableName][key]) {
				return false;
			}
			delete db.tables[tableName][key];
			this.addChange(db, tableName, key, 'delete');
			this.writeDb(db);
			return true;
		} finally {
			if (locked) this.releaseLock();
		}
	}

	public async getChanges(sinceId: number): Promise<ChangeRecord[]> {
		const locked = await this.acquireLock();
		try {
			const db = this.readDb();
			return db.changes.filter((c) => c.id > sinceId);
		} finally {
			if (locked) this.releaseLock();
		}
	}

	public async getLatestChangeId(): Promise<number> {
		const locked = await this.acquireLock();
		try {
			const db = this.readDb();
			if (db.changes.length === 0) return 0;
			return Math.max(...db.changes.map((c) => c.id));
		} finally {
			if (locked) this.releaseLock();
		}
	}

	public async exportData(tableName?: string): Promise<any> {
		const locked = await this.acquireLock();
		try {
			const db = this.readDb();
			if (tableName) {
				return db.tables[tableName] || null;
			}
			return db.tables;
		} finally {
			if (locked) this.releaseLock();
		}
	}

	public async importData(data: any, mode: 'merge' | 'replace'): Promise<void> {
		const locked = await this.acquireLock();
		try {
			const db = this.readDb();
			if (mode === 'replace') {
				db.tables = data || {};
			} else {
				// Merge
				if (data && typeof data === 'object') {
					for (const table of Object.keys(data)) {
						if (!db.tables[table]) {
							db.tables[table] = {};
						}
						if (data[table] && typeof data[table] === 'object') {
							for (const key of Object.keys(data[table])) {
								db.tables[table][key] = data[table][key];
							}
						}
					}
				}
			}

			// Record bulk import change
			this.addChange(db, '*', '*', 'set');
			this.writeDb(db);
		} finally {
			if (locked) this.releaseLock();
		}
	}

	private addChange(
		db: DatabaseSchema,
		tableName: string,
		key: string,
		action: ChangeRecord['action'],
		value?: any,
		type?: string
	): void {
		const nextId = db.changes.length > 0 ? Math.max(...db.changes.map((c) => c.id)) + 1 : 1;
		const change: ChangeRecord = {
			id: nextId,
			tableName,
			key,
			action,
			timestamp: Date.now(),
		};
		// Avoid writing large binary strings to changes log
		if (value !== undefined && type !== 'binary') {
			change.value = value;
			change.type = type;
		} else if (type === 'binary') {
			change.type = 'binary';
			change.value = '[Binary Data]';
		}
		db.changes.push(change);

		// Keep changes array bounded to prevent infinite growth
		if (db.changes.length > 2000) {
			db.changes = db.changes.slice(db.changes.length - 1000);
		}
	}
}

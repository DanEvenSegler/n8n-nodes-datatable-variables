import {
	IExecuteFunctions,
	ILoadOptionsFunctions,
	INodeExecutionData,
	INodePropertyOptions,
	INodeType,
	INodeTypeDescription,
	NodeConnectionTypes,
} from 'n8n-workflow';
import { DbManager } from './db';

const db = new DbManager();

export class DatatableVariablesImportExport implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Datatable Variables Import/Export',
		name: 'datatableVariablesImportExport',
		icon: {
			light: 'file:../../icons/datatable-import-export.svg',
			dark: 'file:../../icons/datatable-import-export.dark.svg',
		},
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		usableAsTool: true,
		description: 'Import or export local datatables and variables',
		defaults: {
			name: 'Datatable Variables Import/Export',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Export',
						value: 'export',
						description: 'Export tables to a file or JSON output',
						action: 'Export tables',
					},
					{
						name: 'Import',
						value: 'import',
						description: 'Import tables from a file or JSON input',
						action: 'Import tables',
					},
				],
				default: 'export',
			},

			// EXPORT PARAMETERS
			{
				displayName: 'Export Mode',
				name: 'exportMode',
				type: 'options',
				displayOptions: {
					show: {
						operation: ['export'],
					},
				},
				options: [
					{
						name: 'All Tables',
						value: 'all',
					},
					{
						name: 'Specific Table',
						value: 'specific',
					},
				],
				default: 'all',
				description: 'Whether to export all tables or just one',
			},
			{
				displayName: 'Table Name',
				name: 'tableName',
				type: 'options',
				typeOptions: {
					loadOptionsMethod: 'getTables',
				},
				default: '',
				required: true,
				displayOptions: {
					show: {
						operation: ['export'],
						exportMode: ['specific'],
					},
				},
				description: 'The name of the table to export',
			},
			{
				displayName: 'Output Format',
				name: 'outputFormat',
				type: 'options',
				displayOptions: {
					show: {
						operation: ['export'],
					},
				},
				options: [
					{
						name: 'JSON File (Binary)',
						value: 'file',
						description: 'Create a binary JSON file for download or sharing',
					},
					{
						name: 'JSON Output',
						value: 'json',
						description: 'Return raw JSON data as node output',
					},
				],
				default: 'file',
				description: 'Format of the exported data',
			},

			// IMPORT PARAMETERS
			{
				displayName: 'Import Mode',
				name: 'importMode',
				type: 'options',
				displayOptions: {
					show: {
						operation: ['import'],
					},
				},
				options: [
					{
						name: 'Merge (Keep Existing, Add/Overwrite New)',
						value: 'merge',
					},
					{
						name: 'Replace (Delete All Existing, Write New)',
						value: 'replace',
					},
				],
				default: 'merge',
				description: 'How to handle existing data in your local datatables',
			},
			{
				displayName: 'Source Type',
				name: 'sourceType',
				type: 'options',
				displayOptions: {
					show: {
						operation: ['import'],
					},
				},
				options: [
					{
						name: 'JSON File (Binary)',
						value: 'file',
						description: 'Read from an uploaded binary JSON file',
					},
					{
						name: 'JSON Input String',
						value: 'json',
						description: 'Read from a raw JSON string input',
					},
				],
				default: 'file',
				description: 'Source of the data to import',
			},
			{
				displayName: 'Input Binary Property Name',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				required: true,
				displayOptions: {
					show: {
						operation: ['import'],
						sourceType: ['file'],
					},
				},
				description: 'Name of the binary property on the input item containing the file to import',
			},
			{
				displayName: 'JSON Input String',
				name: 'jsonInput',
				type: 'string',
				default: '{}',
				required: true,
				displayOptions: {
					show: {
						operation: ['import'],
						sourceType: ['json'],
					},
				},
				description: 'Raw JSON string to import (must represent tables data structure)',
			},
		],
	};

	methods = {
		loadOptions: {
			async getTables(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const tableNames = await db.getTables();
				return tableNames.map(name => ({
					name,
					value: name,
				}));
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const operation = this.getNodeParameter('operation', 0) as 'export' | 'import';

		for (let i = 0; i < items.length; i++) {
			try {
				if (operation === 'export') {
					const exportMode = this.getNodeParameter('exportMode', i) as 'all' | 'specific';
					const outputFormat = this.getNodeParameter('outputFormat', i) as 'file' | 'json';

					let tableName: string | undefined;
					if (exportMode === 'specific') {
						tableName = this.getNodeParameter('tableName', i) as string;
					}

					const data = await db.exportData(tableName);
					if (!data) {
						throw new Error(`Export data failed. ${tableName ? `Table "${tableName}" not found.` : 'Database is empty.'}`);
					}

					if (outputFormat === 'json') {
						returnData.push({
							json: {
								success: true,
								exportedAt: new Date().toISOString(),
								data,
							},
						});
					} else {
						// Binary File Export
						const filename = tableName ? `datatable_${tableName}_export.json` : 'datatables_all_export.json';
						const buffer = Buffer.from(JSON.stringify(data, null, 2), 'utf8');
						const binaryData = await this.helpers.prepareBinaryData(buffer, filename, 'application/json');

						returnData.push({
							json: {
								success: true,
								exportedAt: new Date().toISOString(),
								filename,
								byteSize: buffer.length,
							},
							binary: {
								data: binaryData,
							},
						});
					}
				} else if (operation === 'import') {
					const importMode = this.getNodeParameter('importMode', i) as 'merge' | 'replace';
					const sourceType = this.getNodeParameter('sourceType', i) as 'file' | 'json';

					let parsedData: any;

					if (sourceType === 'json') {
						const jsonStr = this.getNodeParameter('jsonInput', i) as string;
						try {
							parsedData = JSON.parse(jsonStr);
						} catch (e) {
							throw new Error(`Failed to parse JSON string: ${(e as Error).message}`);
						}
					} else {
						const binaryProp = this.getNodeParameter('binaryPropertyName', i) as string;
						const binaryItem = items[i].binary?.[binaryProp];
						if (!binaryItem) {
							throw new Error(`Binary property "${binaryProp}" not found on input item ${i}.`);
						}
						const buffer = await this.helpers.getBinaryDataBuffer(i, binaryProp);
						try {
							parsedData = JSON.parse(buffer.toString('utf8'));
						} catch (e) {
							throw new Error(`Failed to parse uploaded JSON file: ${(e as Error).message}`);
						}
					}

					await db.importData(parsedData, importMode);

					returnData.push({
						json: {
							success: true,
							importMode,
							importedAt: new Date().toISOString(),
							tablesCount: Object.keys(parsedData || {}).length,
						},
					});
				}
			} catch (error) {
				const err = error as Error;
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: err.message,
						},
					});
				} else {
					throw err;
				}
			}
		}

		return [returnData];
	}
}

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

export class DatatableVariables implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Datatable Variables',
		name: 'datatableVariables',
		icon: {
			light: 'file:../../icons/datatable.svg',
			dark: 'file:../../icons/datatable.dark.svg',
		},
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"]}}',
		usableAsTool: true,
		description: 'Store and share variables locally in datatables',
		defaults: {
			name: 'Datatable Variables',
		},
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{
						name: 'Variable',
						value: 'variable',
					},
					{
						name: 'Table',
						value: 'table',
					},
				],
				default: 'variable',
			},
			// Operation for Variable
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['variable'],
					},
				},
				options: [
					{
						name: 'Get',
						value: 'get',
						description: 'Get a variable value',
						action: 'Get a variable',
					},
					{
						name: 'Get All',
						value: 'getAll',
						description: 'Get all variables in a table',
						action: 'Get all variables',
					},
					{
						name: 'Set',
						value: 'set',
						description: 'Set a variable value',
						action: 'Set a variable',
					},
					{
						name: 'Delete',
						value: 'delete',
						description: 'Delete a variable from a table',
						action: 'Delete a variable',
					},
				],
				default: 'get',
			},
			// Operation for Table
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: {
						resource: ['table'],
					},
				},
				options: [
					{
						name: 'List',
						value: 'list',
						description: 'List all tables',
						action: 'List all tables',
					},
					{
						name: 'Delete',
						value: 'delete',
						description: 'Delete a table',
						action: 'Delete a table',
					},
				],
				default: 'list',
			},

			// TABLE OPTIONS (common for most operations except Table List)
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
					hide: {
						resource: ['table'],
						operation: ['list'],
					},
				},
				description: 'The name of the table to operate on. Choose [+ Create New Table...] to create one.',
			},
			{
				displayName: 'New Table Name',
				name: 'newTableName',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						tableName: ['__create_new__'],
					},
					hide: {
						resource: ['table'],
						operation: ['list'],
					},
				},
				description: 'The name of the new table to create',
			},

			// KEY OPTION (for Get, Set, Delete Variable)
			{
				displayName: 'Key',
				name: 'key',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['variable'],
						operation: ['get', 'set', 'delete'],
					},
				},
				description: 'The key of the variable to manage',
			},

			// VALUE TYPE OPTION (for Set Variable)
			{
				displayName: 'Value Type',
				name: 'valueType',
				type: 'options',
				displayOptions: {
					show: {
						resource: ['variable'],
						operation: ['set'],
					},
				},
				options: [
					{ name: 'Text', value: 'text' },
					{ name: 'Number', value: 'number' },
					{ name: 'Boolean', value: 'boolean' },
					{ name: 'JSON', value: 'json' },
					{ name: 'Date', value: 'date' },
					{ name: 'Binary', value: 'binary' },
				],
				default: 'text',
				description: 'The type of the variable to store',
			},

			// VALUE OPTIONS (based on Value Type)
			{
				displayName: 'Value',
				name: 'valueText',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['variable'],
						operation: ['set'],
						valueType: ['text'],
					},
				},
				description: 'The text value to store',
			},
			{
				displayName: 'Value',
				name: 'valueNumber',
				type: 'number',
				default: 0,
				displayOptions: {
					show: {
						resource: ['variable'],
						operation: ['set'],
						valueType: ['number'],
					},
				},
				description: 'The number value to store',
			},
			{
				displayName: 'Value',
				name: 'valueBoolean',
				type: 'boolean',
				default: false,
				displayOptions: {
					show: {
						resource: ['variable'],
						operation: ['set'],
						valueType: ['boolean'],
					},
				},
				description: 'The boolean value to store',
			},
			{
				displayName: 'Value (JSON String)',
				name: 'valueJson',
				type: 'string',
				default: '{}',
				displayOptions: {
					show: {
						resource: ['variable'],
						operation: ['set'],
						valueType: ['json'],
					},
				},
				description: 'The JSON string to store (will be parsed and stored as an object)',
			},
			{
				displayName: 'Value (Date)',
				name: 'valueDate',
				type: 'dateTime',
				default: '',
				displayOptions: {
					show: {
						resource: ['variable'],
						operation: ['set'],
						valueType: ['date'],
					},
				},
				description: 'The date value to store',
			},
			{
				displayName: 'Input Binary Property Name',
				name: 'binaryPropertyName',
				type: 'string',
				default: 'data',
				displayOptions: {
					show: {
						resource: ['variable'],
						operation: ['set'],
						valueType: ['binary'],
					},
				},
				description: 'The name of the binary property on the input item that contains the file to store',
			},
			{
				displayName: 'Output Binary Property Name',
				name: 'outputBinaryPropertyName',
				type: 'string',
				default: 'data',
				displayOptions: {
					show: {
						resource: ['variable'],
						operation: ['get'],
					},
				},
				description: 'If the variable retrieved is a binary file, name of the binary property to create on the output item',
			},
		],
	};

	methods = {
		loadOptions: {
			async getTables(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
				const tableNames = await db.getTables();
				const options = tableNames.map(name => ({
					name,
					value: name,
				}));
				options.unshift({
					name: '[+ Create New Table...]',
					value: '__create_new__',
				});
				return options;
			},
		},
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				if (resource === 'variable') {
					if (operation === 'set') {
						let tableName = this.getNodeParameter('tableName', i) as string;
						if (tableName === '__create_new__') {
							tableName = this.getNodeParameter('newTableName', i) as string;
							await db.createTable(tableName);
						}
						const key = this.getNodeParameter('key', i) as string;
						const valueType = this.getNodeParameter('valueType', i) as 'text' | 'number' | 'boolean' | 'json' | 'date' | 'binary';

						let rawValue: any;
						let mimeType: string | undefined;
						let fileName: string | undefined;

						if (valueType === 'text') {
							rawValue = this.getNodeParameter('valueText', i) as string;
						} else if (valueType === 'number') {
							rawValue = this.getNodeParameter('valueNumber', i) as number;
						} else if (valueType === 'boolean') {
							rawValue = this.getNodeParameter('valueBoolean', i) as boolean;
						} else if (valueType === 'json') {
							const jsonStr = this.getNodeParameter('valueJson', i) as string;
							try {
								rawValue = JSON.parse(jsonStr);
							} catch (e) {
								throw new Error(`Invalid JSON string provided: ${(e as Error).message}`);
							}
						} else if (valueType === 'date') {
							rawValue = this.getNodeParameter('valueDate', i) as string;
						} else if (valueType === 'binary') {
							const binaryProp = this.getNodeParameter('binaryPropertyName', i) as string;
							const binaryItem = items[i].binary?.[binaryProp];
							if (!binaryItem) {
								throw new Error(`Binary property "${binaryProp}" not found on input item ${i}.`);
							}
							rawValue = binaryItem.data; // Base64 string
							mimeType = binaryItem.mimeType;
							fileName = binaryItem.fileName;
						}

						const result = await db.setVariable(tableName, key, rawValue, valueType, mimeType, fileName);

						returnData.push({
							json: {
								success: true,
								tableName,
								key,
								type: valueType,
								updatedAt: result.updatedAt,
								value: valueType === 'binary' ? '[Binary Data]' : rawValue,
							},
						});
					} else if (operation === 'get') {
						const tableName = this.getNodeParameter('tableName', i) as string;
						const key = this.getNodeParameter('key', i) as string;
						const outputBinaryProp = this.getNodeParameter('outputBinaryPropertyName', i) as string;

						const variable = await db.getVariable(tableName, key);
						if (!variable) {
							throw new Error(`Variable "${key}" not found in table "${tableName}".`);
						}

						const returnItem: INodeExecutionData = {
							json: {
								tableName,
								key,
								type: variable.type,
								updatedAt: variable.updatedAt,
								value: variable.type === 'binary' ? '[Binary Data]' : variable.value,
							},
						};

						if (variable.type === 'binary' && variable.value) {
							returnItem.binary = {
								[outputBinaryProp]: {
									data: variable.value, // Base64 data
									mimeType: variable.mimeType || 'application/octet-stream',
									fileName: variable.fileName || 'file',
								},
							};
						}

						returnData.push(returnItem);
					} else if (operation === 'delete') {
						const tableName = this.getNodeParameter('tableName', i) as string;
						const key = this.getNodeParameter('key', i) as string;

						const deleted = await db.deleteVariable(tableName, key);
						returnData.push({
							json: {
								success: deleted,
								tableName,
								key,
							},
						});
					} else if (operation === 'getAll') {
						const tableName = this.getNodeParameter('tableName', i) as string;
						const variables = await db.getVariables(tableName);

						if (!variables) {
							returnData.push({
								json: {
									tableName,
									variables: {},
								},
							});
						} else {
							// Extract values for easy workflow consumption, with binary metadata
							const values: { [key: string]: any } = {};
							for (const k of Object.keys(variables)) {
								const v = variables[k];
								if (v.type === 'binary') {
									values[k] = {
										_type: 'binary',
										fileName: v.fileName,
										mimeType: v.mimeType,
										sizeBytes: Buffer.from(v.value, 'base64').length,
									};
								} else {
									values[k] = v.value;
								}
							}
							returnData.push({
								json: {
									tableName,
									variables: values,
								},
							});
						}
					}
				} else if (resource === 'table') {
					if (operation === 'list') {
						const tableNames = await db.getTables();
						const tablesInfo = [];
						for (const name of tableNames) {
							const variables = await db.getVariables(name);
							tablesInfo.push({
								name,
								variableCount: variables ? Object.keys(variables).length : 0,
							});
						}
						returnData.push({
							json: {
								tables: tablesInfo,
							},
						});
					} else if (operation === 'delete') {
						const tableName = this.getNodeParameter('tableName', i) as string;
						await db.deleteTable(tableName);
						returnData.push({
							json: {
								success: true,
								tableName,
							},
						});
					}
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

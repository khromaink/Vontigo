import crypto from 'node:crypto';
import ObjectID from 'bson-objectid';
import { v4 as uuidv4 } from 'uuid';

import sqlite3 from 'sqlite3';
import knex, { Knex } from 'knex';

// Configuration object for Knex
const config = {
	development: {
		client: 'sqlite3',
		connection: {
			filename: './database/vontigo.db'
		},
		useNullAsDefault: true,
		migration: {
			directory: './migrations'
		}
	},
	production: {
		client: 'mysql',
		connection: {
			host: '179.61.199.11',
			user: 'vontigo',
			password: 'VontigoP@ssw0rd',
			database: 'vontigo',
			charset: 'utf8'
		},
		migration: {
			directory: './migrations'
		}
	}
};

// Function to handle boolean data types
function handleBooleanTypes(schema: string): string {
	// Replace boolean types with tinyint(1) in the schema
	return schema.replace(/(\s)BOOLEAN(\s)/gi, '$1tinyint(1)$2');
}

/** @type {import('./$types').RequestHandler} */
export async function GET({ url }) {
	// Get the Knex configuration for the current environment
	const knexConfigDev = config.development;
	const knexConfigProd = config.production;

	// Initialize Knex with the current configuration
	const _knexDev: Knex = await knex(knexConfigDev);
	const _knexProd: Knex = await knex(knexConfigProd);

	// Create a connection to the SQLite database
	const db = new sqlite3.Database(knexConfigDev.connection.filename);

	// Get a list of all the table names in the SQLite database
	db.all(
		"SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
		function (err, tables) {
			if (err) throw err;

			// Loop through each table and create and migrate it to the corresponding MySQL table
			tables.forEach(function (table) {
				const tableName = table.name;

				// Get the schema information for the SQLite table
				db.get(
					`SELECT sql FROM sqlite_master WHERE type='table' AND name='${tableName}'`,
					function (err, row) {
						if (err) throw err;

						if (row) {
							let schema = row.sql
								.replace(/^CREATE TABLE\s+[^\s]+\s+\(/i, '(')
								.replace(/\n/g, '')
								.replace(/\s+/g, ' ')
								.replace(/\"/g, '`');

							// Handle boolean data types in the schema
							schema = handleBooleanTypes(schema);

							// Create the MySQL table based on the schema information
							_knexDev.schema
								.raw(schema)
								.then(function () {
									console.log(`Table '${tableName}' created`);
								})
								.catch(function (err) {
									console.error(`Error creating table '${tableName}':`, err);
								});

							// Migrate the data to the MySQL table
							db.all(`SELECT * FROM ${tableName}`, function (err, rows) {
								if (err) throw err;

								rows.forEach(function (row) {
									_knexDev(tableName)
										.insert(row)
										.then(function () {
											console.log(`Inserted row into '${tableName}':`, row);
										});
								});
							});
						} else {
							console.error(`Table '${tableName}' not found`);
						}
					}
				);
			});
		}
	);

	// Close the database connections
	db.close();
	_knexDev.destroy();

	return new Response(JSON.stringify({ message: uuidv4() }), { status: 200 });
}

function generatePostId(title: string): string {
	const hash = crypto.createHash('sha256').update(title).digest('hex');
	return hash;
}
function generateId(): string {
	const timestamp = Date.now().toString(36);
	const randomStr = Math.random().toString(36).substr(2, 6);
	return `${timestamp}${randomStr}`.substr(0, 24);
}

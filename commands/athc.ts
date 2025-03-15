import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

import * as fs from 'fs'
import * as tmp from 'tmp'

import ExcelJS from 'exceljs'
import { Piscina } from 'piscina'
import os from 'os'

import { BaseSchema } from '@adonisjs/lucid/schema'
import { Knex } from 'knex'

import { DateTime } from 'luxon'
import path from 'path'
import { defineConfig } from '@adonisjs/lucid'
import { Database } from '@adonisjs/lucid/database'
import app from '@adonisjs/core/services/app'
import { Logger } from '@adonisjs/core/logger'
import { Emitter } from '@adonisjs/core/events'

import { targets } from '@adonisjs/core/logger'
import { cuid } from '@adonisjs/core/helpers'
import string from '@adonisjs/core/helpers/string'

type People = Record<string, any>

type WorkerPayload = {
  cwd: string //Current Working Directory
  verbose: boolean
  postgreSQL: {
    usePostgreSQL: boolean
    database?: string
    user?: string
    password?: string
    host?: string
    port?: number
  }
  sqlite: {
    location?: string
  }
  workerName: string
  data: People[]
}

export default class Athc extends BaseCommand {
  static commandName = 'athc'
  static description =
    'Reads an .xlsx file and inserts data into a SQL database (SQLite or PostgreSQL) [ in `people` table ]'

  static help = [
    'The athc command reads an .xlsx file and inserts the data into a SQL database (SQLite or PostgreSQL) [ in `people` table ].',
    '',
    'You can process and save the contents of the .xlsx file from the stdin input in the database.',
    '(By default, data is stored in a SQLite database internal to the command)',
    'Example usage:',
    'cat ./people_sample.xlsx | {{ binaryName }} athc',
    'or',
    '{{ binaryName }} athc < ./people_sample.xlsx',
    '',
    'You can also use the --file (or -f) option to specify a file without using the stdin entry',
    'Example usage:',
    '{{ binaryName }} athc --file ./people_sample.xlsx',
    'or',
    '{{ binaryName }} athc -f ./people_sample.xlsx',
    '',
    'Use the --location (or -l) option if you wish to specify the path to the SQLite file that will be created, in order to access its contents once the data has been saved.',
    'Example usage:',
    '{{ binaryName }} athc --location ./db.sqlite3 < ./people_sample.xlsx',
    'or',
    '{{ binaryName }} athc -l ./db.sqlite3 < ./people_sample.xlsx',
    '',
    'The --verbose (or -v) option displays details of current operations.',
    'Example usage:',
    '{{ binaryName }} athc --verbose < ./people_sample.xlsx',
    'or',
    '{{ binaryName }} athc -v < ./people_sample.xlsx',
    '',
    'Use the --host (or -h), --port (or -p), --database (or -d), --user (or -u) and --password (or -w) options, if you want to use a PostgreSQL database instead of SQLite.',
    'Example usage:',
    '{{ binaryName }} athc --host 127.0.0.1 --port 5432 --database myDB --user johndoe --password myPassword < ./people_sample.xlsx',
    'or',
    '{{ binaryName }} athc -h 127.0.0.1 -p 5432 -d myDB -u johndoe -w myPassword < ./people_sample.xlsx',
    '',
    'The --batch (or -b) option allows you to specify the number of rows to be inserted at once per SQL query to improve performance (the default value is 100).',
    'Example usage:',
    '{{ binaryName }} athc --batch 500 < ./people_sample.xlsx',
    'or',
    '{{ binaryName }} athc -b 500 < ./people_sample.xlsx',
    '',
    'The --thread (or -t) option lets you specify the number of threads to be used to improve performance (the default value is equal to the number of threads available on your machine - 1 [ to avoid overloading the machine ], but is equal to 2 without subtraction if there are only 2).',
    'Example usage:',
    '{{ binaryName }} athc --thread 12 < ./people_sample.xlsx',
    'or',
    '{{ binaryName }} athc -t 12 < ./people_sample.xlsx',
    '',
    'The --concurrent (or -c) option lets you specify the number of concurrent tasks to be used to improve performance (the default value is 4).',
    'Example usage:',
    '{{ binaryName }} athc --concurrent 8 < ./people_sample.xlsx',
    'or',
    '{{ binaryName }} athc -c 8 < ./people_sample.xlsx',
  ]

  static options: CommandOptions = {
    startApp: true,
  }

  @flags.string({
    required: false,
    alias: ['f'],
    description: 'Absolute or relative path of the xlsx file to be processed',
  })
  declare file?: string

  @flags.number({
    required: false,
    default: 100,
    alias: ['b'],
    flagName: 'batch',
    description: 'Number of rows inserted at once per SQL query',
  })
  declare batchSize: number

  @flags.number({
    required: false,
    default: os.cpus().length - 1, // Use all cores - 1
    alias: ['t'],
    flagName: 'thread',
    description: 'Number of threads to be used',
  })
  declare maxThreads: number

  @flags.number({
    required: false,
    default: 4,
    alias: ['c'],
    flagName: 'concurrent',
    description: 'Number of concurrent tasks',
  })
  declare concurrentTasks: number

  @flags.string({
    required: false,
    alias: ['h'],
    description: 'PostgreSQL server host',
  })
  declare host?: string

  @flags.number({
    required: false,
    alias: ['p'],
    description: 'PostgreSQL server port',
  })
  declare port?: number

  @flags.string({
    required: false,
    alias: ['u'],
    description: 'PostgreSQL server user',
  })
  declare user?: string

  @flags.string({
    required: false,
    alias: ['w'],
    description: 'PostgreSQL server password',
  })
  declare password?: string

  @flags.string({
    required: false,
    alias: ['d'],
    description: 'PostgreSQL server database',
  })
  declare database?: string

  @flags.string({
    required: false,
    alias: ['l'],
    description: 'SQLite location',
  })
  declare location?: string

  @flags.boolean({
    required: false,
    default: false,
    alias: ['v'],
    description: 'Activate “verbose” mode to display current actions.',
  })
  declare verbose: boolean

  /**
   * Creates the columns for the "People" table based on the specified columns.
   *
   * @param table - The `Knex.CreateTableBuilder` object used to define the table structure.
   * @param columns - An array of objects representing the columns to be created.
   * @param columns[].name - The name of the column.
   * @param columns[].exist - Indicates whether the column already exists (true) or needs to be created (false).
   *
   * @remarks
   * - The `id` column is created as a `bigIncrements` type and set as the primary key if it does not exist.
   * - Other columns are created as `string` type with a maximum length of 254 characters and are `NOT NULL`.
   */
  createPeopleTable(table: Knex.CreateTableBuilder, columns: { name: string; exist: boolean }[]) {
    for (let index = 0; index < columns.length; index++) {
      const column = columns[index]
      if (column.name === 'id') {
        !column.exist && table.bigIncrements('id', { primaryKey: true })
      } else {
        !column.exist && table.string(column.name, 254).notNullable()
      }
    }
  }

  /**
   * Initializes the "People" table in the database.
   *
   * @param columns - An array of column names to be created or checked for existence.
   * @param usePostgreSQL - A boolean flag indicating whether to use PostgreSQL (default: `false`, uses SQLite).
   *
   * @remarks
   * - Determines the database configuration based on the `usePostgreSQL` flag.
   * - Uses `better-sqlite3` for SQLite or `pg` for PostgreSQL.
   * - Creates a logger and an event emitter for handling logs and events.
   * - Initializes a database connection and schema manager.
   * - Checks if the "People" table exists:
   *   - If not, it creates the table with the specified columns.
   *   - If the table exists, it checks for missing columns and alters the table if needed.
   */
  async initPeopleTable(columns: string[], usePostgreSQL = false) {
    const sqlitePath = this.location
      ? path.isAbsolute(this.location)
        ? this.location
        : path.join(process.cwd(), this.location)
      : app.tmpPath('db.sqlite3')

    const dbConfig = usePostgreSQL
      ? defineConfig({
          connection: 'postgres',
          connections: {
            postgres: {
              client: 'pg',
              connection: {
                host: this.host,
                port: this.port,
                user: this.user,
                password: this.password,
                database: this.database,
              },
              migrations: {
                naturalSort: true,
                paths: ['database/migrations'],
              },
            },
          },
        })
      : defineConfig({
          connection: 'sqlite',
          connections: {
            sqlite: {
              client: 'better-sqlite3',
              connection: {
                filename: sqlitePath,
              },
              useNullAsDefault: true,
              migrations: {
                naturalSort: true,
                paths: ['database/migrations'],
              },
            },
          },
        })

    const loggerConfig = {
      name: 'athc',
      level: 'info',
      transport: {
        targets: targets()
          .pushIf(!app.inProduction, targets.pretty())
          .pushIf(app.inProduction, targets.file({ destination: 1 }))
          .toArray(),
      },
    }

    const logger = new Logger(loggerConfig)
    const emitter = new Emitter(app)

    const db = new Database(dbConfig, logger, emitter)

    const schema = new BaseSchema(db.connection(), 'migration_people')

    const tableName = 'people'
    const peopleTableExist = await schema.schema.hasTable(tableName)

    if (!peopleTableExist) {
      await schema.schema.createTable(tableName, (table) => {
        this.createPeopleTable(
          table,
          columns.map((name) => {
            return { name, exist: false }
          })
        )
      })
    } else {
      const columnsWithCheckExist: { name: string; exist: boolean }[] = []
      for (let index = 0; index < columns.length; index++) {
        const columnName = columns[index]
        const exist = await schema.schema.hasColumn(tableName, columnName)
        columnsWithCheckExist.push({ name: columnName, exist })
      }

      if (columnsWithCheckExist.some((column) => !column.exist)) {
        await schema.schema.alterTable(tableName, (table) => {
          this.createPeopleTable(table, columnsWithCheckExist)
        })
      }
    }
  }

  /**
   * Creates a readable file stream for the given file path.
   * If the provided path is absolute, it is used directly.
   * Otherwise, the path is resolved relative to the current working directory.
   *
   * @param filePath - The path to the file.
   *                   If it is relative, it will be resolved from the current working directory.
   *
   * @returns A readable stream of the specified file.
   */
  createFileReadStream(filePath: string) {
    if (path.isAbsolute(filePath)) {
      return fs.createReadStream(filePath)
    } else {
      return fs.createReadStream(path.join(process.cwd(), filePath))
    }
  }

  /**
   * Converts a date string into an SQL-compatible date format.
   * The method tries to parse the given date string using multiple expected formats.
   * If a valid format is found, it returns the corresponding SQL date.
   *
   * @param dateString - The date string to convert. Expected formats:
   *                     'dd-MM-yyyy', 'yyyy-MM-dd', 'yyyy/MM/dd', 'dd/MM/yyyy'.
   *
   * @returns The converted date in SQL format (YYYY-MM-DD) if successfully parsed, otherwise `undefined`.
   */
  convertDateStringToSQLDate(dateString: string) {
    const expectedFormats = ['dd-MM-yyyy', 'yyyy-MM-dd', 'yyyy/MM/dd', 'dd/MM/yyyy']
    let sqlDate
    for (let index = 0; index < expectedFormats.length; index++) {
      const expectedFormat = expectedFormats[index]
      sqlDate = DateTime.fromFormat(dateString, expectedFormat).toSQLDate()
      if (sqlDate) {
        return sqlDate
      }
    }

    return sqlDate || undefined
  }

  /**
   * Checks if an object contains any attributes with `null` or `undefined` values.
   *
   * @param obj - The object to check, represented as a record of key-value pairs.
   *
   * @returns `true` if at least one attribute is `null` or `undefined`, otherwise `false`.
   */
  hasNullOrUndefinedAttributes(obj: Record<string, any>) {
    return Object.values(obj).some((value) => value === null || value === undefined)
  }

  /**
   * Creates a worker payload containing database connection details and batch data.
   *
   * @param cwd - The current working directory.
   * @param usePostgreSQL - A boolean indicating whether PostgreSQL is used.
   * @param batchData - An array of `People` objects to be processed.
   *
   * @returns A `WorkerPayload` object with database configuration and batch data.
   */
  createWorkerPayload(cwd: string, usePostgreSQL: boolean, batchData: People[]): WorkerPayload {
    return {
      cwd,
      verbose: this.verbose,
      postgreSQL: {
        usePostgreSQL,
        database: this.database,
        user: this.user,
        password: this.password,
        host: this.host,
        port: this.port,
      },
      sqlite: {
        location: this.location,
      },
      workerName: cuid(),
      data: [...batchData],
    }
  }

  /**
   * Executes the main process of importing data from an Excel file or stdin to a database.
   *
   * 1. Determines whether PostgreSQL is used based on provided credentials.
   * 2. Creates a temporary file to store input data.
   * 3. Reads from a specified file or stdin and writes the data into the temporary file.
   * 4. Reads the Excel file, processes rows into batches, and distributes them to worker threads.
   * 5. Initializes the `people` table if it doesn't exist.
   * 6. Manages a worker pool to handle data processing efficiently.
   * 7. Ensures all tasks are completed before cleaning up and terminating the process.
   *
   * @returns {Promise<void>} Resolves when the process is completed.
   */
  async run() {
    // 1. Determines whether PostgreSQL is used based on provided credentials.
    const usePostgreSQL =
      this.database || this.user || this.password || this.host || this.port ? true : false

    if (usePostgreSQL) {
      if (!this.database) {
        const errorMessage = 'The --database (or -d) option is not set.'
        console.error(errorMessage)
        this.error = errorMessage
        this.exitCode = 1
        return
      }
      if (!this.user) {
        const errorMessage = 'The --user (or -u) option is not set.'
        console.error(errorMessage)
        this.error = errorMessage
        this.exitCode = 1
        return
      }
      if (!this.password) {
        const errorMessage = 'The --password (or -w) option is not set.'
        console.error(errorMessage)
        this.error = errorMessage
        this.exitCode = 1
        return
      }
      if (!this.host) {
        const errorMessage = 'The --host (or -h) option is not set.'
        console.error(errorMessage)
        this.error = errorMessage
        this.exitCode = 1
        return
      }
      if (!this.port) {
        const errorMessage = 'The --port (or -p) option is not set.'
        console.error(errorMessage)
        this.error = errorMessage
        this.exitCode = 1
        return
      }
    }

    // 2. Creates a temporary file to store input data.
    const tmpFile = tmp.fileSync({ postfix: '.xlsx' })
    const writeStream = fs.createWriteStream(tmpFile.name)

    // 3. Reads from a specified file or stdin and writes the data into the temporary file.
    let sourceStream: fs.ReadStream | null = null
    if (this.file) {
      // Open source file for reading
      sourceStream = this.createFileReadStream(this.file)
    }
    if (sourceStream) {
      // Store source file in a temporary file
      sourceStream.pipe(writeStream)
    } else {
      const timeout = setTimeout(() => {
        console.error('No input detected in stdin.')
        process.exit(1)
      }, 500) // 500 ms delay before command stop if there is no input on stdin

      process.stdin.once('data', () => {
        clearTimeout(timeout) // Data received in stdin input, stop canceled
      })
      // Store stdin in a temporary file
      process.stdin.pipe(writeStream)
    }

    writeStream.on('finish', async () => {
      //Determine the maximum number of threads to be used
      const maxThreads = Math.max(2, Math.min(this.maxThreads, os.cpus().length))
      this.concurrentTasks = Math.min(this.concurrentTasks, maxThreads)
      console.log('Max thread: ', maxThreads)

      // Initialize worker pool
      const workerPool = new Piscina({
        filename: this.app.startPath('worker.js'),
        maxThreads,
      })

      // 4. Reads the Excel file, processes rows into batches, and distributes them to worker threads.
      const workbook = new ExcelJS.Workbook()
      await workbook.xlsx.readFile(tmpFile.name)

      const worksheet = workbook.worksheets[0]

      let batchData: People[] = []
      let activeTasks = 0
      let queue: WorkerPayload[] = [] // Batch queue
      const cwd = process.cwd() //Current Working Directory

      const processQueue = async () => {
        if (activeTasks >= this.concurrentTasks || queue.length === 0) return
        activeTasks++
        const batch = queue.shift()
        await workerPool.run(batch)
        activeTasks--
        processQueue() // Continue with the next batch
      }

      let columns: string[] = []
      let tableInitializationPromise: Promise<void> | null = null
      worksheet.eachRow((row, rowNumber) => {
        const rowData = Array.isArray(row.values) ? row.values.slice(1) : [] // Removes unnecessary index

        // 5. Initializes the `people` table if it doesn't exist.
        if (rowNumber === 1) {
          columns = rowData
            .map((c) => {
              const value = c?.toString()
              return value ? string.snakeCase(value) : value
            })
            .filter((c) => c !== undefined)
          if (columns.length === 0) {
            console.error('File column headers are missing')
            process.exit(1)
          }

          tableInitializationPromise = this.initPeopleTable(
            ['id'].concat(columns),
            usePostgreSQL
          ).catch((reason) => {
            console.error(reason)
            process.exit(1)
          })
        } else {
          if (!tableInitializationPromise) {
            console.error('Table initialization promise is missing.')
            process.exit(1)
          }

          tableInitializationPromise.then(() => {
            const people: People = rowData.reduce(
              (
                previousValue: People,
                currentValue: ExcelJS.CellValue,
                currentIndex: number
              ): People => {
                const columnName = columns[currentIndex]
                previousValue[columnName] = currentValue
                return previousValue
              },
              {}
            )

            if (this.hasNullOrUndefinedAttributes(people)) {
              console.error('The following occurrence has one or more invalid properties: ', people)
            } else {
              batchData.push(people)
            }

            // 6. Manages a worker pool to handle data processing efficiently.
            if (batchData.length >= this.batchSize) {
              const workerPayload = this.createWorkerPayload(cwd, usePostgreSQL, batchData)
              queue.push(workerPayload)
              batchData = []
              processQueue()
            }
          })
        }
      })

      do {
        await new Promise((res) => setTimeout(res, 100))
      } while (activeTasks !== 0 || queue.length > 0)

      // Send last remaining batch
      if (batchData.length > 0) {
        const workerPayload = this.createWorkerPayload(cwd, usePostgreSQL, batchData)
        queue.push(workerPayload)
        await processQueue()
      }

      // 7. Ensures all tasks are completed before cleaning up and terminating the process.
      // Wait until all workers have finished
      while (activeTasks > 0 || queue.length > 0) {
        await new Promise((res) => setTimeout(res, 100)) // Wait until it's all over
      }

      do {
        await new Promise((res) => setTimeout(res, 100))
      } while (activeTasks !== 0)

      console.log('Import complete')
      await workerPool.destroy()

      // Clean temporary file
      tmpFile.removeCallback()

      await this.terminate()

      process.exit(0)
    })
  }
}

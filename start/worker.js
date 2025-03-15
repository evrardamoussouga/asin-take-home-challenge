import 'reflect-metadata'
import { Application } from '@adonisjs/core/app'
import { Database } from '@adonisjs/lucid/database'
import { Logger } from '@adonisjs/core/logger'
import { Emitter } from '@adonisjs/core/events'

import { defineConfig } from '@adonisjs/lucid'
import path from 'path'
import { fileURLToPath } from 'url'

import { defineConfig as defineConfigLogger, targets } from '@adonisjs/core/logger'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const APP_ROOT = new URL('../', import.meta.url)

/**
 * The importer is used to import files in context of the
 * application.
 */
const IMPORTER = (filePath) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, APP_ROOT).href)
  }
  return import(filePath)
}

/**
 * Executes a worker task that inserts data into a database.
 *
 * 1. Initializes the AdonisJS application in a console environment.
 * 2. Configures the database connection (PostgreSQL or SQLite).
 * 3. Sets up a logger and event emitter.
 * 4. Attempts to insert data into the `people` table, with up to 5 retry attempts
 *    in case of a `53300` (too many connections) error using exponential backoff.
 * 5. Logs progress if verbose mode is enabled.
 * 6. Closes the database connection after execution.
 *
 * @param {WorkerPayload} payload - The data and configuration for the worker task.
 * @returns {Promise<{ success: boolean, error?: Error }>} A success flag and an error if one occurs.
 */
export default async function workerTask(payload) {
  // 1. Initializes the AdonisJS application in a console environment.
  const app = new Application(APP_ROOT, { importer: IMPORTER, environment: 'console' })
  await app.boot()

  // 2. Configures the database connection (PostgreSQL or SQLite).
  const sqlitePath = payload?.sqlite?.location
    ? path.isAbsolute(payload?.sqlite?.location)
      ? payload?.sqlite?.location
      : path.join(payload.cwd, payload?.sqlite?.location)
    : path.join(process.cwd(), './db.sqlite3')

  const dbConfig = payload?.postgreSQL?.usePostgreSQL
    ? defineConfig({
        connection: 'postgres',
        connections: {
          postgres: {
            client: 'pg',
            connection: {
              host: payload.postgreSQL.host,
              port: payload.postgreSQL.port,
              user: payload.postgreSQL.user,
              password: payload.postgreSQL.password,
              database: payload.postgreSQL.database,
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

  // 3. Sets up a logger and event emitter.
  const loggerConfig = defineConfigLogger({
    default: 'app',

    /**
     * The loggers object can be used to define multiple loggers.
     * By default, we configure only one logger (named "app").
     */
    loggers: {
      app: {
        enabled: true,
        name: 'athc',
        level: 'info',
        transport: {
          targets: targets()
            .pushIf(!app.inProduction, targets.pretty())
            .pushIf(app.inProduction, targets.file({ destination: 1 }))
            .toArray(),
        },
      },
    },
  })
  const logger = new Logger(loggerConfig)
  const emitter = new Emitter(app)
  const db = new Database(dbConfig, logger, emitter)

  /*
   * 4. Attempts to insert data into the `people` table, with up to 5 retry attempts
   *    in case of a `53300` (too many connections) error using exponential backoff.
   */
  let attempts = 0
  const maxRetries = 5
  let errorMessage = ''

  while (attempts < maxRetries) {
    try {
      if (payload.data && payload.data.length > 0) {
        await db.insertQuery().table('people').multiInsert(payload.data)

        //5. Logs progress if verbose mode is enabled.
        if (payload.verbose) {
          console.log(
            `${payload.data.length} occurrence(s) created by worker["${payload.workerName}"]`
          )
        }
      }
      break
    } catch (error) {
      errorMessage = error.message
      if (error?.code == '53300') {
        attempts++
        const delay = Math.pow(2, attempts) * 100 // Exponential backoff (100ms, 200ms, 400ms...)
        console.warn(
          `Attempt ${attempts}/${maxRetries} - Too many connections. Retry in ${delay}ms`
        )

        await new Promise((resolve) => setTimeout(resolve, delay))
      } else {
        console.error('error: ', errorMessage)
        await db.manager.closeAll()
        return { success: false, error }
      }
    }
  }

  if (attempts >= maxRetries) {
    console.error('error: ', errorMessage)
  }

  // 6. Closes the database connection after execution.
  await db.manager.closeAll()

  return { success: true }
}

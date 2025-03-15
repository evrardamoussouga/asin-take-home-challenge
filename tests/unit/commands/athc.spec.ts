import { test } from '@japa/runner'
import ace from '@adonisjs/core/services/ace'
import { exec as callbackExec } from 'child_process'
import { promisify } from 'util'
import { performance } from 'perf_hooks'
import fs from 'fs'
import { Assert } from '@japa/assert'
import path from 'path'
import { fileURLToPath } from 'url'
import env from '#start/env'
import db from '@adonisjs/lucid/services/db'
import { BaseSchema } from '@adonisjs/lucid/schema'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const exec = promisify(callbackExec)

const timeRefPerformance = 1200000

const testCommandWithError = async (
  command: string,
  errorExpected: string,
  assert: Assert,
  exitCode = 1
) => {
  try {
    const { stdout } = await exec(command)
    assert.notOk(stdout, stdout)
  } catch (error) {
    assert.equal(error.code, exitCode)
    assert.include(error.stderr, errorExpected)
  }
}

const testCommand = async (command: string, messageExpected: string | string[], assert: Assert) => {
  try {
    const start = performance.now() // Démarrer le chronomètre
    const { stdout } = await exec(command)
    const end = performance.now() // Fin du chronomètre
    if (typeof messageExpected === 'string') {
      assert.include(stdout, messageExpected)
    } else {
      for (let index = 0; index < messageExpected.length; index++) {
        const message = messageExpected[index]
        assert.include(stdout, message)
      }
    }
    const executionTime = end - start
    console.log(
      `Execution time: ${executionTime.toFixed(2)} ms ( either ${(executionTime / 1000).toFixed(2)} seconde(s) or ${(executionTime / 60000).toFixed(2)} minute(s) )`
    )
    assert.isBelow(
      executionTime,
      timeRefPerformance,
      `The command took more than ${(timeRefPerformance / 60000).toFixed(2)} minutes (${(executionTime / 60000).toFixed(2)} minutes)`
    )
  } catch (error) {
    assert.notOk(error, error)
  }
}

test.group('Commands athc', (group) => {
  group.each.setup(() => {
    ace.ui.switchMode('raw')
    return () => ace.ui.switchMode('normal')
  })

  group.each.teardown(async () => {
    fs.unlink(path.join(process.cwd(), './db.sqlite3'), (err) => {
      if (err) {
        //console.error('Error deleting file:', err)
      } else {
        //console.log('File deleted successfully!')
      }
    })
    try {
      const schema = new BaseSchema(db.connection('postgres'), 'migration_people')
      await schema.schema.dropTableIfExists('people')
    } catch (error) {}
  })

  test('Make sure that the --help option displays help for the athc command', async ({
    assert,
  }) => {
    await testCommand(
      'node ace athc --help',
      'Reads an .xlsx file and inserts data into a SQL database (SQLite or PostgreSQL) [ in `people` table ]',
      assert
    )
  })

  test('Ensure that an error is displayed when no file is sent as input to the command', async ({
    assert,
  }) => {
    await testCommandWithError('node ace athc', 'No input detected in stdin', assert)
  })

  test('Ensure that data is saved in the SQLite database when sent via stdin (using cat)', async ({
    assert,
  }) => {
    await testCommand(
      'cat ./resources/people_sample.xlsx | node ace athc',
      'Import complete',
      assert
    )
  })

  test('Ensure that data is saved in the SQLite database when sent via stdin (using <)', async ({
    assert,
  }) => {
    await testCommand('node ace athc < ./resources/people_sample.xlsx', 'Import complete', assert)
  })

  test('Ensure that data is saved in the SQLite database when sent via --file (or -f) option [relative path]', async ({
    assert,
  }) => {
    await testCommand(
      'node ace athc --file ./resources/people_sample.xlsx',
      'Import complete',
      assert
    )
  })

  test('Ensure that data is saved in the SQLite database when sent via --file (or -f) option [absolute path]', async ({
    assert,
  }) => {
    const filePath = path.join(__dirname, '../../../resources/people_sample.xlsx')
    await testCommand(`node ace athc --file ${filePath}`, 'Import complete', assert)
  })

  test('Ensure that the --location (or -l) option modifies the location of the SQLite file [relative path]', async ({
    assert,
  }) => {
    await testCommand(
      'node ace athc --location ./resources/db.sqlite3 < ./resources/people_sample.xlsx',
      'Import complete',
      assert
    )
    const dbPath = path.join(__dirname, '../../../resources/db.sqlite3')
    assert.equal(fs.existsSync(dbPath), true, 'SQLite database location remains unchanged')
  }).teardown(() => {
    const dbPath = path.join(__dirname, '../../../resources/db.sqlite3')
    fs.unlink(dbPath, (err) => {
      if (err) {
        //console.error('Error deleting file:', err)
      } else {
        //console.log('File deleted successfully!')
      }
    })
  })

  test('Ensure that the --location (or -l) option modifies the location of the SQLite file [absolute path]', async ({
    assert,
  }) => {
    const dbPath = path.join(__dirname, '../../../resources/db.sqlite3')
    await testCommand(
      `node ace athc --location ${dbPath} < ./resources/people_sample.xlsx`,
      'Import complete',
      assert
    )

    assert.equal(fs.existsSync(dbPath), true, 'SQLite database location remains unchanged')
  }).teardown(() => {
    const dbPath = path.join(__dirname, '../../../resources/db.sqlite3')
    fs.unlink(dbPath, (err) => {
      if (err) {
        //console.error('Error deleting file:', err)
      } else {
        //console.log('File deleted successfully!')
      }
    })
  })

  test('Ensure that the --verbose (or -v) option displays details of the operations performed', async ({
    assert,
  }) => {
    await testCommand(
      'node ace athc --verbose < ./resources/people_sample.xlsx',
      ['occurrence(s) created by worker', 'Import complete'],
      assert
    )
  })

  test('Ensure that data is saved in the PostgreSQL database', async ({ assert }) => {
    const errorMessageMissingEnvValue = (envName: string, exampleValue: string) => {
      return `The ${envName} environment variable is not defined in the terminal, so it must be specified with the export command before running the test command. (for example, export HOST=${exampleValue})`
    }
    const host = env.get('DB_HOST')
    const port = env.get('DB_PORT')
    const database = env.get('DB_DATABASE')
    const user = env.get('DB_USER')
    const password = env.get('DB_PASSWORD')
    assert.isDefined(host, errorMessageMissingEnvValue('DB_HOST', '127.0.0.1'))
    assert.isDefined(port, errorMessageMissingEnvValue('DB_PORT', '5432'))
    assert.isDefined(database, errorMessageMissingEnvValue('DB_DATABASE', 'myDB'))
    assert.isDefined(user, errorMessageMissingEnvValue('DB_USER', 'johndoe'))
    assert.isDefined(password, errorMessageMissingEnvValue('DB_PASSWORD', 'myPassword'))

    await testCommand(
      `node ace athc --host ${host} --port ${port} --database ${database} --user ${user} --password ${password} < ./resources/people_sample.xlsx`,
      'Import complete',
      assert
    )
  })

  test('Performance test (Database: SQLite - Batch: 100 - Thread: 2 - Concurrent task: 2) ', async ({
    assert,
  }) => {
    await testCommand(
      'node ace athc --batch 100 --thread 2 --concurrent 2 < ./resources/people_sample.xlsx',
      'Import complete',
      assert
    )
  })

  test('Performance test (Database: SQLite - Batch: 100 - Thread: 4 - Concurrent task: 4) ', async ({
    assert,
  }) => {
    await testCommand(
      'node ace athc --batch 100 --thread 4 --concurrent 4 < ./resources/people_sample.xlsx',
      'Import complete',
      assert
    )
  })

  test('Performance test (Database: SQLite - Batch: 100 - Thread: 6 - Concurrent task: 6) ', async ({
    assert,
  }) => {
    await testCommand(
      'node ace athc --batch 100 --thread 6 --concurrent 6 < ./resources/people_sample.xlsx',
      'Import complete',
      assert
    )
  })

  test('Performance test (Database: SQLite - Batch: 100 - Thread: 8 - Concurrent task: 8) ', async ({
    assert,
  }) => {
    await testCommand(
      'node ace athc --batch 100 --thread 8 --concurrent 8 < ./resources/people_sample.xlsx',
      'Import complete',
      assert
    )
  })

  test('Performance test (Database: SQLite - Batch: 100 - Thread: 10 - Concurrent task: 10) ', async ({
    assert,
  }) => {
    await testCommand(
      'node ace athc --batch 100 --thread 10 --concurrent 10 < ./resources/people_sample.xlsx',
      'Import complete',
      assert
    )
  })

  test('Performance test (Database: SQLite - Batch: 100 - Thread: 11 - Concurrent task: 11) ', async ({
    assert,
  }) => {
    await testCommand(
      'node ace athc --batch 100 --thread 12 --concurrent 12 < ./resources/people_sample.xlsx',
      'Import complete',
      assert
    )
  })

  test('Performance test (Database: SQLite - Batch: 100 - Thread: 12 - Concurrent task: 12) ', async ({
    assert,
  }) => {
    await testCommand(
      'node ace athc --batch 100 --thread 12 --concurrent 12 < ./resources/people_sample.xlsx',
      'Import complete',
      assert
    )
  })

  test('Performance test (Database: SQLite - Batch: 500 - Thread: 2 - Concurrent task: 2) ', async ({
    assert,
  }) => {
    await testCommand(
      'node ace athc --batch 500 --thread 2 --concurrent 2 < ./resources/people_sample.xlsx',
      'Import complete',
      assert
    )
  })

  test('Performance test (Database: SQLite - Batch: 500 - Thread: 4 - Concurrent task: 4) ', async ({
    assert,
  }) => {
    await testCommand(
      'node ace athc --batch 500 --thread 4 --concurrent 4 < ./resources/people_sample.xlsx',
      'Import complete',
      assert
    )
  })

  test('Performance test (Database: SQLite - Batch: 500 - Thread: 8 - Concurrent task: 8) ', async ({
    assert,
  }) => {
    await testCommand(
      'node ace athc --batch 500 --thread 8 --concurrent 8 < ./resources/people_sample.xlsx',
      'Import complete',
      assert
    )
  })

  test('Performance test (Database: SQLite - Batch: 500 - Thread: 10 - Concurrent task: 10) ', async ({
    assert,
  }) => {
    await testCommand(
      'node ace athc --batch 500 --thread 10 --concurrent 10 < ./resources/people_sample.xlsx',
      'Import complete',
      assert
    )
  })

  test('Performance test (Database: SQLite - Batch: 500 - Thread: 11 - Concurrent task: 11) ', async ({
    assert,
  }) => {
    await testCommand(
      'node ace athc --batch 500 --thread 11 --concurrent 11 < ./resources/people_sample.xlsx',
      'Import complete',
      assert
    )
  })

  test('Performance test (Database: SQLite - Batch: 500 - Thread: 12 - Concurrent task: 12) ', async ({
    assert,
  }) => {
    await testCommand(
      'node ace athc --batch 500 --thread 11 --concurrent 12 < ./resources/people_sample.xlsx',
      'Import complete',
      assert
    )
  })

  test('Performance test (Database: PostgreSQL - Batch: 100 - Thread: 2 - Concurrent task: 2) ', async ({
    assert,
  }) => {
    const errorMessageMissingEnvValue = (envName: string, exampleValue: string) => {
      return `The ${envName} environment variable is not defined in the terminal, so it must be specified with the export command before running the test command. (for example, export HOST=${exampleValue})`
    }
    const host = env.get('DB_HOST')
    const port = env.get('DB_PORT')
    const database = env.get('DB_DATABASE')
    const user = env.get('DB_USER')
    const password = env.get('DB_PASSWORD')
    assert.isDefined(host, errorMessageMissingEnvValue('DB_HOST', '127.0.0.1'))
    assert.isDefined(port, errorMessageMissingEnvValue('DB_PORT', '5432'))
    assert.isDefined(database, errorMessageMissingEnvValue('DB_DATABASE', 'myDB'))
    assert.isDefined(user, errorMessageMissingEnvValue('DB_USER', 'johndoe'))
    assert.isDefined(password, errorMessageMissingEnvValue('DB_PASSWORD', 'myPassword'))

    await testCommand(
      `node ace athc --batch 100 --thread 2 --concurrent 2 --host ${host} --port ${port} --database ${database} --user ${user} --password ${password} < ./resources/people_sample.xlsx`,
      'Import complete',
      assert
    )
  })

  test('Performance test (Database: PostgreSQL - Batch: 500 - Thread: 2 - Concurrent task: 2) ', async ({
    assert,
  }) => {
    const errorMessageMissingEnvValue = (envName: string, exampleValue: string) => {
      return `The ${envName} environment variable is not defined in the terminal, so it must be specified with the export command before running the test command. (for example, export HOST=${exampleValue})`
    }
    const host = env.get('DB_HOST')
    const port = env.get('DB_PORT')
    const database = env.get('DB_DATABASE')
    const user = env.get('DB_USER')
    const password = env.get('DB_PASSWORD')
    assert.isDefined(host, errorMessageMissingEnvValue('DB_HOST', '127.0.0.1'))
    assert.isDefined(port, errorMessageMissingEnvValue('DB_PORT', '5432'))
    assert.isDefined(database, errorMessageMissingEnvValue('DB_DATABASE', 'myDB'))
    assert.isDefined(user, errorMessageMissingEnvValue('DB_USER', 'johndoe'))
    assert.isDefined(password, errorMessageMissingEnvValue('DB_PASSWORD', 'myPassword'))

    await testCommand(
      `node ace athc --batch 500 --thread 2 --concurrent 2 --host ${host} --port ${port} --database ${database} --user ${user} --password ${password} < ./resources/people_sample.xlsx`,
      'Import complete',
      assert
    )
  })
})

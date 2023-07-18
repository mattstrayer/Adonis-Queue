import { DatabaseContract } from '@ioc:Adonis/Lucid/Database'
import { DateTime } from 'luxon'
import SuperJSON from 'superjson'
import { RedisDriverConfig, JobRecord, QueueDriver, StoreOptions } from '../types'
import Redis from '@ioc:Adonis/Addons/Redis'

export default class RedisDriver implements QueueDriver {
  constructor(protected config: RedisDriverConfig, private database: DatabaseContract) {}

  public pollingDelay = this.config.pollingDelay || 2000

  /**
   * Store job to redis
   */
  public async store(path: string, payload: any, options?: StoreOptions) {
    const message = {
      class_path: path,
      payload,

      // utilize redis lists here to store the queue order for each group
      // https://redis.io/docs/data-types/lists/
      // https://quarkus.io/blog/redis-job-queue/
    }

    const key = `${this.config.keyPrefix}:`

    await Redis.set(key, SuperJSON.stringify(message))

    await this.database.table(this.config.tableName).insert({
      class_path: path,
      payload: SuperJSON.serialize(payload),
      available_at: options?.availableAt || DateTime.now().toSQL(),
    })
  }

  /**
   * Get next job from database
   */
  public getNext(): Promise<JobRecord | null> {
    return this.database
      .from(this.config.tableName)
      .where('available_at', '<', DateTime.now().toSQL())
      .where({ failed: false })
      .forUpdate()
      .skipLocked()
      .first()
  }

  /**
   * Get job from database by its ID
   */
  public getJob(id: number | string): Promise<JobRecord | null> {
    return this.database
      .from(this.config.tableName)
      .where('available_at', '<', DateTime.now().toSQL())
      .where({ id: id })
      .first()
  }

  /**
   * Re-schedule job (update attempts and available_at) in Database
   */
  public async reSchedule(job: JobRecord, retryAfter: number) {
    await this.database
      .from(this.config.tableName)
      .where({ id: job.id })
      .update({
        attempts: job.attempts,
        available_at: DateTime.now().plus({ seconds: retryAfter }),
      })
  }

  /**
   * Mark job as failed in database
   */
  public async markFailed(job: JobRecord) {
    await this.database.from(this.config.tableName).where({ id: job.id }).update({
      failed: true,
      attempts: job.attempts,
    })
  }

  /**
   * Remove job from database
   */
  public async remove(id: number | string): Promise<void> {
    await this.database.from(this.config.tableName).where({ id: id }).delete()
  }
}

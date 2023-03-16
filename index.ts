import { QueueManager } from './src/QueueManager'

declare module '@ioc:Adonis/Core/Application' {
  export interface ContainerBindings {
    'Cavai/Adonis-Queue': QueueManager<any>
  }
}

export { QueueManager }
export { BaseJob } from './src/BaseJob'
export { defineConfig } from './src/DefineConfig'

export default class { } // Bug in Adonis

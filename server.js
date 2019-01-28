'use strict'

const debug = require('debug')('platziverse:mqtt')
const mosca = require('mosca')
const redis = require('redis')
const chalk = require('chalk')
const db = require('platziverse-db')
const utils = require('platziverse-utils')
let Agent, Metric,Type
let clients = new Map()
const backend = {
  type: 'redis',
  redis,
  return_buffers: true
}

const settings = {
  port: 1883,
  backend
}

const server = new mosca.Server(settings)

server.on('clientConnected', client => {
  debug(`Client Connected: ${client.id}`)
  clients.set(client.id, null)
})

server.on('clientDisconnected', async (client) => {
  debug(`Client Disconnected: ${client.id}`)
  let agent = clients.get(client.id)
  if (agent) {
    agent.connected = false
    try {
      await Agent.createOrUpdate(agent)
    } catch (err) {
      return handleError(err)
    }

    debug(`Agent with client id ${client.id} and uuid ${agent.uuid} marked like disconnected `)
    clients.delete(client.id)

    server.publish({
      'topic': 'agent/disconnected',
      'payload': JSON.stringify({
        agent: {
          uuid: agent.uuid
        }
      })
    })
  }
})

server.on('published', (packet, client) => {
  debug(`Package Topic ${packet.topic}`)
  switch (packet.topic) {
    case "agent/connected":
      debug(`Package Payload: ${packet.payload}`)
      break
    case "agent/disconnected":
      debug(`Package Payload: ${packet.payload}`)
      break
    case "agent/message":
      processMessage(packet, client)
      break
  }
})

server.on('ready', async () => {
  const service = await db.init(db.setupConfig()).catch(handleFatalError)
  Agent = service.Agent
  Metric = service.Metric
  Type= service.MetricType
  console.log(`${chalk.green('[platziverse-mqtt]')}- server is running`)
})

server.on('error', handleFatalError)

process.on('uncaughtException', handleFatalError)
process.on('unhandledRejection', handleError)

function handleFatalError (err) {
  console.log(`${chalk.red('[fatal error]')} - ${err.message}`)
  console.log(err.stack)
  process.exit(1)
}

function handleError (err) {
  console.log(`${chalk.red('[error]')} - ${err.message}`)
  console.log(err.stack)
}

async function processMessage (packet, client) {
  debug(`Package Payload: ${packet.payload}`)
  const payload = utils.parsePayload(packet.payload)

  if (payload) {
    payload.agent.connected = true
    let agent
    try {
      agent = await Agent.createOrUpdate(payload.agent)
    } catch (err) {
      return handleError(err)
    }
    debug(`Agent with uuid ${agent.uuid} saved`)

   

    // Create new metrics
    await Promise.all(payload.metrics.map(async metric => {
      try {
        let type= await Type.createOrUpdate(metric.type)
        let newMetric= {
          typeId:type.id,
          value:metric.value
        }      
        return Metric.create(agent.uuid, newMetric)
      } catch (err) {
        return handleError(err)
      }
    }))

    debug(`Metrics for agent with uuid ${agent.uuid} saved`)
     // Notify new agent
     if (!clients.get(client.id)) {
      clients.set(client.id, agent)
      server.publish({
        topic: 'agent/connected',
        payload: JSON.stringify({
          agent: {
            uuid: agent.uuid,
            username: agent.username,
            name: agent.name,
            hostname: agent.hostname,
            pid: agent.pid,
            connected: agent.connected
          }
        })
      })
    }
  }
}

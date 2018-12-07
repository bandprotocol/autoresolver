const delay = require('delay')
const Koa = require('koa')

const knex = require('knex')({
  client: 'sqlite3',
  connection: ':memory:',
})

const bookshelf = require('bookshelf')(knex)
const app = new Koa()

async function sendResolveTransaction(address, isTCR) {
  // TODO
  console.log('sendResolveTransaction', address, isTCR)
}

async function queryResolveTime(address, onChainID, isTCR) {
  // TODO
  console.log('queryResolveTime', address, onChainID, isTCR)
  return 0
}

async function handleNewEvent(address, onChainID) {
  // TODO
  console.log('handleNewEvent', address, onChainID)
}

async function handleResolveEvent(address, onChainID) {
  // TODO
  console.log('handleResolveEvent', address, onChainID)
}

async function handleSubscribe(address, isTCR) {
  // TODO
}

async function handleUnsubscribe(address) {
  // TODO
}

app.use(async ctx => {
  ctx.body = 'Hello, World!'
})
;(async () => {
  while (true) {
    await delay(1000)
    // TODO
  }
})()

app.listen(9999)

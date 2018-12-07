const delay = require('delay')
const Koa = require('koa')

const Web3Interface = require('./app/mock')

const app = new Koa()
let web3 = null

async function onNewTask(address, onChainID, resolveTime, blockNumber) {
  console.log('NEW TASK', address, onChainID, resolveTime, blockNumber)
}

async function onTaskResolved(address, onChainID, blockNumber) {
  console.log('TASK RESOLVED', address, onChainID, resolveTime, blockNumber)
}

async function onEventLoop() {
  console.log('EVENT LOOP')
}

// TODO: Initialize database here

// TODO: Initialize add/remove address route here

;(async () => {
  // Initialize Web3Interface
  web3 = new Web3Interface(
    {
      '0xe2533EF05C50Ed4C2E429EAC21F045Def751a1dD': true,
      '0x53704BBfaF366706C0DDb19B4fBd10b93Ee50A6A': false,
    },
    3464700,
    15,
    onNewTask,
    onTaskResolved,
  )

  // Run the event loop every 1 second
  ;(async () => {
    while (true) {
      await delay(1000)
      await onEventLoop()
    }
  })()

  app.listen(9999)
})()

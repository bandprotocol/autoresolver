const delay = require('delay')

class Web3Interface {
  constructor(contracts, lastBlock, lookBehind, onNewTask, onTaskResolved) {
    this.hasSubscription = false
    this.onNewTask = onNewTask
    this.onTaskResolved = onTaskResolved
    this.contracts = contracts
    this.currentBlock = lastBlock

    this.subscribeAll()
  }

  sendResolveTransaction(addr, onChainID) {
    console.log(`Sending Resolve Transaction: ${addr}-${onChainID}`)
    ;(async () => {
      await delay(Math.round(Math.random() * 20000) + 3000)
      await this.onTaskResolved(addr, onChainID, ++this.currentBlock)
    })()
  }

  addContract(addr, isTCR) {
    if (this.contracts.hasOwnProperty(addr)) {
      throw new Error(`Cannot add ${addr} as it already exists`)
    }

    this.contracts[addr] = isTCR
  }

  removeContract() {
    if (this.contracts.hasOwnProperty(addr)) {
      throw new Error(`Cannot remove ${addr} as it does not exist`)
    }

    delete this.contracts[addr]
  }

  subscribeAll() {
    ;(async () => {
      while (true) {
        await delay(3000)
        const keys = Object.keys(this.contracts)
        const addr = keys[Math.floor(Math.random() * keys.length)]
        const onChainID = Math.floor(Math.random() * 1000000).toString()
        const next10Seconds = new Date(new Date().getTime() + 10000)
        await this.onNewTask(
          addr,
          onChainID,
          next10Seconds,
          ++this.currentBlock,
        )
      }
    })()
  }
}

module.exports = Web3Interface

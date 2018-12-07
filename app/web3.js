const Web3 = require('web3')
const delay = require('delay')

const abis = require('./abi')

const web3 = new Web3('wss://rinkeby.infura.io/ws')
const tcr = abis.TCR
const params = abis.Parameters

class Web3Interface {
  constructor(contracts, lastBlock, lookBehind, onNewTask, onTaskResolved) {
    this.hasSubscription = false
    this.onNewTask = onNewTask
    this.onTaskResolved = onTaskResolved
    this.contracts = contracts
    this.lastBlock = lastBlock
    this.lookBehind = lookBehind
    ;(async () => {
      while (!web3.currentProvider.connected) {
        await delay(100)
      }
      this.subscribeAll()
    })()
  }

  sendResolveTransaction(addr, onChainID) {
    throw new Error('Not Implemented')
  }

  addContract(addr, isTCR) {
    throw new Error('Not Implemented')
  }

  removeContract() {
    throw new Error('Not Implemented')
  }

  subscribeAll() {
    web3.eth.subscribe(
      'logs',
      {
        address: Object.keys(this.contracts),
        fromBlock: this.lastBlock - this.lookBehind,
      },
      async (err, result) => {
        if (err) {
          console.log('ERROR: ', err)
          return
        }

        const addr = result.address
        const isTCR = this.contracts[addr]

        if (isTCR === undefined) {
          console.log(`Receiving event from unknown address ${addr}`)
          return
        }

        let onChainID
        let resolveTimestamp

        if (isTCR) {
          const contract = new web3.eth.Contract(tcr, addr)
          contract._decodeEventABI.call(
            contract._generateEventOptions('allevents').event,
            result,
          )

          if (result.event !== 'ChallengeInitiated') {
            return
          }

          onChainID = result.returnValues.challengeID
          resolveTimestamp = (await contract.methods
            .challenges(onChainID)
            .call()).revealEndTime
        } else {
          const contract = new web3.eth.Contract(params, addr)
          contract._decodeEventABI.call(
            contract._generateEventOptions('allevents').event,
            result,
          )

          if (result.event !== 'NewProposal') {
            return
          }

          onChainID = result.returnValues.proposalID
          resolveTimestamp = (await contract.methods
            .proposals(onChainID)
            .call()).expiration
        }

        this.onNewTask(
          addr,
          onChainID,
          new Date(resolveTimestamp * 1000),
          result.blockNumber,
        )
      },
    )
  }
}

module.exports = Web3Interface

const Web3 = require('web3')
const delay = require('delay')
const abis = require('./abi')

const config = require('../config')

const reader = new Web3('wss://rinkeby.infura.io/ws')
const tcr = abis.TCR
const params = abis.Parameters

const sender = new Web3(
  new Web3.providers.IpcProvider(
    '/home/bun/.ethereum/rinkeby/geth.ipc',
    require('net'),
  ),
)

const passPhase = config.accountPassword

class Web3Interface {
  constructor(
    contracts,
    lastBlock,
    lookBehind,
    onNewTask,
    onTaskResolved,
    onTaskNotPassed,
  ) {
    this.hasSubscription = false
    this.onNewTask = onNewTask
    this.onTaskResolved = onTaskResolved
    this.onTaskNotPassed = onTaskNotPassed
    this.contracts = contracts
    this.lastBlock = lastBlock
    this.lookBehind = lookBehind
    ;(async () => {
      while (!reader.currentProvider.connected) {
        await delay(100)
      }
      while (!sender.currentProvider.connected) {
        await delay(100)
      }
      this.subscribeAll()
    })()
  }

  sendResolveTransaction(addr, onChainID, nonce) {
    console.log('We need to send resolve', addr, onChainID)
    const isTCR = this.contracts[addr]
    if (isTCR === undefined) {
      console.log("This address doesn't exist in dictionary")
      return
    }

    ;(async () => {
      const accountAddress = (await sender.eth.getAccounts())[0]
      if (
        !(await sender.eth.personal.unlockAccount(
          accountAddress,
          passPhase,
          100,
        ))
      ) {
        console.log('Cannot unlock account')
      }
      if (!isTCR) {
        const contract = new sender.eth.Contract(params, addr)
        contract.methods
          .resolve(onChainID)
          .estimateGas()
          .then(async gas => {
            console.log('GAssssssssssss', gas)
            await contract.methods
              .resolve(onChainID)
              .send({ from: accountAddress, gas: 200000, nonce })
          })
          .catch(err => {
            console.log(err)
            this.onTaskNotPassed(addr, onChainID)
          })
      } else {
        const contract = new sender.eth.Contract(tcr, addr)
        contract.methods
          .resolveChallenge(onChainID)
          .estimateGas()
          .then(async _ => {
            await contract.methods.resolveChallenge(onChainID).send({
              from: accountAddress,
              gas: 200000,
              nonce,
            })
          })
          .catch(() => this.onTaskNotPassed(addr, onChainID))
      }
    })()
  }

  async getNonce() {
    const accountAddress = (await sender.eth.getAccounts())[0]
    return await sender.eth.getTransactionCount(accountAddress, 'pending')
  }

  addContract(addr, isTCR) {
    throw new Error('Not Implemented')
  }

  removeContract() {
    throw new Error('Not Implemented')
  }

  subscribeAll() {
    reader.eth.subscribe(
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

        if (isTCR) {
          const contract = new reader.eth.Contract(tcr, addr)
          contract._decodeEventABI.call(
            contract._generateEventOptions('allevents').event,
            result,
          )
          const onChainID = result.returnValues.challengeID
          switch (result.event) {
            case 'ChallengeInitiated': {
              const resolveTimestamp = (await contract.methods
                .challenges(onChainID)
                .call()).revealEndTime
              this.onNewTask(
                addr,
                onChainID,
                new Date(resolveTimestamp * 1000 + 10000),
                result.blockNumber,
              )
              return
            }
            case 'ChallengeResolved': {
              this.onTaskResolved(addr, onChainID, result.blockNumber)
              return
            }
            default:
              return
          }
        } else {
          const contract = new reader.eth.Contract(params, addr)
          contract._decodeEventABI.call(
            contract._generateEventOptions('allevents').event,
            result,
          )

          const onChainID = result.returnValues.proposalID
          switch (result.event) {
            case 'NewProposal': {
              const resolveTimestamp = (await contract.methods
                .proposals(onChainID)
                .call()).expiration
              this.onNewTask(
                addr,
                onChainID,
                new Date(resolveTimestamp * 1000 + 10000),
                result.blockNumber,
              )
              return
            }
            case 'ProposalResolved': {
              this.onTaskResolved(addr, onChainID, result.blockNumber)
              return
            }
            default:
              return
          }
        }
      },
    )
  }
}

module.exports = Web3Interface

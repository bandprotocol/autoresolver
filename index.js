const delay = require('delay')
const Koa = require('koa')
const Sequelize = require('sequelize')
const Op = Sequelize.Op

const Web3Interface = require('./app/mock')

const app = new Koa()
let web3 = null

const addressToID = {}

async function onNewTask(address, onChainID, resolveTime, blockNumber) {
  console.log('NEW TASK', address, onChainID, resolveTime, blockNumber)
  if (addressToID[address] === undefined) {
    console.log(`This contract address ${address} doesn't appear in database`)
  }

  await Task.findOrCreate({
    where: {
      contractID: addressToID[address],
      onChainID: onChainID,
    },
    defaults: {
      finishedAt: resolveTime,
      status: 'WAITING',
    },
  })

  await Setting.update(
    {
      value: blockNumber,
    },
    {
      where: {
        key: 'last_block_processed',
      },
    },
  )
}

async function onTaskResolved(address, onChainID, blockNumber) {
  console.log('TASK RESOLVED', address, onChainID, blockNumber)
}

async function onEventLoop() {
  console.log('EVENT LOOP')
  const allTask = await Task.findAll()
  console.log('Length = ', allTask.length)
}

// TODO: Initialize database here
const sequelize = new Sequelize('db', 'band', 'band', {
  dialect: 'sqlite',
})

const Contract = sequelize.define('contract', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  address: Sequelize.STRING,
  contractType: Sequelize.STRING,
  subscribe: Sequelize.BOOLEAN,
})

const Task = sequelize.define('task', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  onchainID: Sequelize.INTEGER,
  finishedAt: Sequelize.DATE,
  status: Sequelize.STRING,
})

Task.belongsTo(Contract)

const Setting = sequelize.define('setting', {
  key: Sequelize.STRING,
  value: Sequelize.INTEGER,
})

// TODO: Initialize add/remove address route here
;(async () => {
  // TODO: Initialize everything here
  await sequelize.sync()
  await Contract.create({
    address: '0xe2533EF05C50Ed4C2E429EAC21F045Def751a1dD',
    contractType: 'TCR',
    subscribe: true,
  })
  await Contract.create({
    address: '0x53704BBfaF366706C0DDb19B4fBd10b93Ee50A6A',
    contractType: 'PARAMETER',
    subscribe: true,
  })

  await Setting.create({
    key: 'last_block_processed',
    value: 0,
  })

  const addressList = await Contract.findAll()
  addressList.forEach(address => {
    const contract = address.get({ plain: true })
    addressToID[contract.address] = contract.id
  })

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

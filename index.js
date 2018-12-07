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

  const task = await Task.findOne({
    where: {
      contractID: addressToID[address],
      onChainID: onChainID,
    },
  })

  console.log('O', onChainID, addressToID[address])
  if (!task) {
    const mt = await Task.create({
      contractID: addressToID[address],
      onChainID,
      finishedAt: resolveTime,
      status: 'WAITING',
    })
    // console.log(mt)
  }

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

  web3.sendResolveTransaction(address, onChainID)
}

async function onTaskResolved(address, onChainID, blockNumber) {
  console.log('Resolve', addressToID[address], onChainID)
  await Task.update(
    {
      status: 'RESOLVED',
    },
    {
      where: {
        contractID: addressToID[address],
        onChainID: onChainID,
      },
    },
  )

  const tasks = await Task.findAll({
    where: {
      contractID: addressToID[address],
      onChainID: onChainID,
    },
  })

  tasks.forEach(task =>
    console.log(
      task.get({
        plain: true,
      }),
    ),
  ),
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

async function onEventLoop() {
  // console.log('EVENT LOOP')
  const allTask = await Task.findAll()
  const waitingTask = await Task.findAll({
    where: {
      status: 'WAITING',
    },
  })
  const resolvedTask = await Task.findAll({
    where: {
      status: 'RESOLVED',
    },
  })
  console.log(
    'Length = ',
    allTask.length,
    'Waiting',
    waitingTask.length,
    'Resolved',
    resolvedTask.length,
  )

  // console.log('show all task')
  // allTask.forEach(task => console.log(task.get({ plain: true })))
}

// TODO: Initialize database here
const sequelize = new Sequelize('db', 'band', 'band', {
  dialect: 'sqlite',
  logging: false,
})

const Contract = sequelize.define('contract', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  address: {
    allowNull: false,
    type: Sequelize.STRING,
  },
  contractType: {
    allowNull: false,
    type: Sequelize.STRING,
  },
  subscribe: Sequelize.BOOLEAN,
})

const Task = sequelize.define(
  'task',
  {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    onChainID: {
      allowNull: false,
      type: Sequelize.INTEGER,
    },
    finishedAt: Sequelize.DATE,
    status: Sequelize.STRING,
  },
  {
    indexes: [
      {
        unique: true,
        fields: ['contractID', 'onChainID'],
      },
    ],
  },
)

Task.belongsTo(Contract, { foreignKey: 'contractID' })

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

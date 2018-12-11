const delay = require('delay')
const Koa = require('koa')
const Sequelize = require('sequelize')
const Op = Sequelize.Op

const Web3Interface = require('./app/web3')

const app = new Koa()
let web3 = null

const waitTime = 90000

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

  if (!task) {
    const mt = await Task.create({
      contractID: addressToID[address],
      onChainID,
      finishedAt: resolveTime,
      status: 'WAITING',
    })
  }

  await Setting.update(
    {
      value: blockNumber,
    },
    {
      where: {
        key: {
          [Op.like]: 'last_block_processed',
        },
      },
    },
  )
}

async function onTaskNotPassed(address, onChainID) {
  console.log('NOT RESOLVE', address, onChainID)
  const task = await Task.findOne({
    where: {
      contractID: addressToID[address],
      onChainID: onChainID,
    },
  })

  if (!task) {
    await Task.create({
      contractID: addressToID[address],
      onChainID,
      finishedAt: new Date(),
      status: 'NOT_PASSED',
    })
    return
  }

  if (task.status === 'RESOLVED') return

  await Task.update(
    {
      status: 'NOT_PASSED',
    },
    {
      where: {
        contractID: addressToID[address],
        onChainID: onChainID,
      },
    },
  )
}

async function onTaskResolved(address, onChainID, blockNumber) {
  console.log('RESOLVED', address, onChainID, blockNumber)
  const task = await Task.findOne({
    where: {
      contractID: addressToID[address],
      onChainID: onChainID,
    },
  })

  if (!task) {
    await Task.create({
      contractID: addressToID[address],
      onChainID,
      finishedAt: new Date(),
      status: 'RESOLVED',
    })
    return
  }
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

  await Setting.update(
    {
      value: blockNumber,
    },
    {
      where: {
        key: {
          [Op.like]: 'last_block_processed',
        },
      },
    },
  )
}

async function onEventLoop() {
  // console.log('EVENT LOOP')
  const allTask = await Task.findAll()
  const waitingTask = await Task.findAll({
    where: {
      status: {
        [Op.like]: 'WAITING',
      },
    },
  })
  const resolveingTask = await Task.findAll({
    where: {
      status: {
        [Op.like]: 'RESOLVING',
      },
    },
  })
  const resolvedTask = await Task.findAll({
    where: {
      status: {
        [Op.like]: 'RESOLVED',
      },
    },
  })
  const notPassedTask = await Task.findAll({
    where: {
      status: {
        [Op.like]: 'NOT_PASSED',
      },
    },
  })

  const nonce = await web3.getNonce()

  console.log(
    'Length = ',
    allTask.length,
    'Waiting',
    waitingTask.length,
    'Resolved',
    resolvedTask.length,
    'Resolving',
    resolveingTask.length,
    'Not passed',
    notPassedTask.length,
    'Pending resolve',
    nonce,
  )

  // Send resolve after waiting
  const now = new Date()
  const needResolvedTasks = await Task.findAll({
    include: [
      {
        model: Contract,
      },
    ],
    where: {
      status: {
        [Op.like]: 'WAITING',
      },
      finishedAt: {
        [Op.lt]: now,
      },
    },
  })

  for (const task of needResolvedTasks) {
    web3.sendResolveTransaction(task.contract.address, task.onChainID)
    const now = new Date().getTime()
    const nextTxSent = new Date(now + waitTime)
    task.update({ status: 'RESOLVING', nextTxSent })
  }

  // Resend resolve in some bad case happen
  const needResendTasks = await Task.findAll({
    include: [
      {
        model: Contract,
      },
    ],
    where: {
      status: {
        [Op.like]: 'RESOLVING',
      },
      nextTxSent: {
        [Op.lt]: now,
      },
    },
  })

  console.log('Nonce:', nonce)
  for (const task of needResendTasks) {
    web3.sendResolveTransaction(task.contract.address, task.onChainID, nonce)
    const now = new Date().getTime()
    const nextTxSent = new Date(now + waitTime)
    task.update({ nextTxSent })
  }
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
    nextTxSent: Sequelize.DATE,
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

  await Setting.create({
    key: 'wait_until_resend',
    value: 90,
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
    onTaskNotPassed,
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

let hasSubscription = false

exports.subscribeOneUntil = async (address, isTCR, untilBlock, callback) => {
  if (hasSubscription) {
    throw new Error('A subscription already exists')
  }

  hasSubscription = true
  // TODO
  hasSubscription = false
}

exports.subscribeAll = (contracts, callback) => {
  if (hasSubscription) {
    throw new Error('A subscription already exists')
  }

  // TODO
  hasSubscription = true
}

exports.unsubscribeAll = contracts => {
  if (!hasSubscription) {
    throw new Error('No active subscription to unsubscribe')
  }

  // TODO
  hasSubscription = false
}

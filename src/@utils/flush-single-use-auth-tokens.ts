
import { response } from 'cfw-easy-utils'
import moment from 'moment'
import { groupBy, map } from 'lodash'
import { handleResponse } from './'
import Bluebird from 'bluebird'

export default async function flushSingleUseAuthTokens({ env }: { env: { META: KVNamespace, TX_FEES: DurableObjectNamespace}}) {
  const { META, TX_FEES } = env

  const { keys } = await META.list({prefix: 'suat:', limit: 100})
  const allExpiredKeys = keys
  .filter(({metadata}: any) => moment.utc(metadata, 'X').isBefore())
  .map(({name}) => {
    const [, publicKey, transactionHash] = name.split(':')
    return {
      publicKey,
      transactionHash
    }
  })

  const groupedExpiredKeys = map(groupBy(allExpiredKeys, 'publicKey'), (value: any, key: any) => {
    return {
      publicKey: key,
      transactionHashes: map(value, 'transactionHash')
    }
  })

  const promiseResponse = await Bluebird.mapSeries(groupedExpiredKeys, ({ publicKey, transactionHashes }: { publicKey: string, transactionHashes: any[]}) => {
    const txFeesId = TX_FEES.idFromName(publicKey)
    const txFeesStub = TX_FEES.get(txFeesId)

    return txFeesStub.fetch(`/${publicKey}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(transactionHashes)
    }).then(handleResponse)
  })

  return response.json(promiseResponse)
}
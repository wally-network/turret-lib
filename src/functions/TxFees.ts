import { response } from 'cfw-easy-utils'
import { handleResponse, authTxToken, processFeePayment } from '../@utils'
import { EnvProps } from '../types';
export class TxFees {

  static async get({ request, env }: { request: Request, env: EnvProps }) {
    const { TX_FEES, STELLAR_NETWORK } = env
    
    const feeToken = request.headers.get('authorization')?.split(' ')?.[1]
  
    const AuthTx = authTxToken(STELLAR_NETWORK, feeToken)
    if (!AuthTx) return;
    const { 
      hash: authedHash,
      publicKey: authedPublicKey, 
      data: authedContracts,
      singleUse,
    } = AuthTx;
    const txFeesId = TX_FEES.idFromName(authedPublicKey)
    const txFeesStub = TX_FEES.get(txFeesId)

    // Check if durable objects are enabled
    const feeMetadata = await txFeesStub.fetch('/').then(handleResponse(response))
      
    if (!feeMetadata)
      throw {status: 404, message: `Fee balance could not be found this turret` }

      return response.json({
      hash: authedHash,
      publicKey: authedPublicKey,
      lastModifiedTime: feeMetadata.lastModifiedTime,
      balance: feeMetadata.balance,
      txFunctionHashes: authedContracts,
      singleUse
    }, {
      headers: {
        'Cache-Control': 'public, max-age=5',
      }
    })
  }

  static async pay({ request, params, env }: { request: Request, params: { publicKey: string }, env: EnvProps  }) {
    const { TX_FEES, XLM_FEE_MIN, XLM_FEE_MAX, HORIZON_URL, STELLAR_NETWORK, TURRET_ADDRESS } = env;
    const { publicKey } = params

    const body = await request.json()
    const { txFunctionFee: feePaymentXdr } = body

    if (!TX_FEES) return;
    
    const txFeesId = TX_FEES.idFromName(publicKey)
    const txFeesStub = TX_FEES.get(txFeesId)

    const { hash: paymentHash, amount: paymentAmount } = await processFeePayment({ HORIZON_URL, STELLAR_NETWORK, TURRET_ADDRESS }, feePaymentXdr, XLM_FEE_MIN, XLM_FEE_MAX)

    const { lastModifiedTime, balance } = await txFeesStub.fetch('/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        plus: paymentAmount
      })
    }).then(handleResponse)

    return response.json({
      publicKey,
      paymentHash,
      lastModifiedTime,
      balance,
    })
  }
}
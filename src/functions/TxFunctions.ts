import { response, Stopwatch } from 'cfw-easy-utils'
import shajs from 'sha.js'
import { handleResponse, authTxToken, processFeePayment } from '../@utils'
import { EnvProps } from '../types';
import { Transaction, Networks, Keypair } from 'stellar-base'
import BigNumber from 'bignumber.js'


export class TxFunctions {
  static async get({ params, env }: { params: { txFunctionHash: string }, env: { TX_FUNCTIONS: KVNamespace }}) {
    const { TX_FUNCTIONS } = env
    const { txFunctionHash } = params
  
    const { value, metadata }: {value: ArrayBuffer | null, metadata:any} = await TX_FUNCTIONS.getWithMetadata(txFunctionHash, 'arrayBuffer')
    if (!value)
      throw {status: 404, message: `txFunction could not be found this turret`}
  
    const { length, txFunctionSignerPublicKey } = metadata
  
    const txFunctionBuffer = Buffer.from(value)
    const txFunction = txFunctionBuffer.slice(0, length).toString()
    const txFunctionFields = JSON.parse(txFunctionBuffer.slice(length).toString())
  
    return response.json({
      function: txFunction,
      fields: txFunctionFields,
      signer: txFunctionSignerPublicKey
    }, {
      headers: {
        'Cache-Control': 'public, max-age=2419200', // 28 days
      }
    })
  }

  static async upload({ request, env }: { request: Request, env: EnvProps}) {
    const { TX_FUNCTIONS, HORIZON_URL, TURRET_ADDRESS, STELLAR_NETWORK, UPLOAD_DIVISOR, XLM_FEE_MAX } = env
    const body = await request.formData()
  
    // Check TX_FUNCTIONS and UPLOAD_DIVISOR
    if (!TX_FUNCTIONS || !UPLOAD_DIVISOR) return;

    const txFunctionFields = body.get('txFunctionFields')

    // Check txFunctionFields
    if (typeof txFunctionFields !== 'string') return;
    const txFunctionFieldsBuffer = txFunctionFields ? Buffer.from(txFunctionFields, 'base64') : Buffer.alloc(0)
  
    // Test to ensure txFunctionFields is valid JSON
    if (txFunctionFields)
      JSON.parse(txFunctionFieldsBuffer.toString())
  
    const txFunction = body.get('txFunction')
    // Check txFunction
    if (typeof txFunction !== 'string') return;
    const txFunctionBuffer = Buffer.from(txFunction)
  
    const txFunctionConcat = Buffer.concat([txFunctionBuffer, txFunctionFieldsBuffer])
    const txFunctionHash = shajs('sha256').update(txFunctionConcat).digest('hex')
  
    const txFunctionExists = await TX_FUNCTIONS.get(txFunctionHash, 'arrayBuffer')
  
    if (txFunctionExists)
      throw `txFunction ${txFunctionHash} has already been uploaded to this turret`
  
    const txFunctionSignerKeypair = Keypair.random()
    const txFunctionSignerSecret = txFunctionSignerKeypair.secret()
    const txFunctionSignerPublicKey = txFunctionSignerKeypair.publicKey()
  
    const cost = new BigNumber(txFunctionConcat.length).dividedBy(UPLOAD_DIVISOR).toFixed(7)
  
    let transactionHash
  
    try {
      const txFunctionFee = body.get('txFunctionFee')
  
      // throws if payment fails
      // If processPayment max is optional XLM_FEE_MAX should be removed
      await processFeePayment({ HORIZON_URL, STELLAR_NETWORK, TURRET_ADDRESS }, txFunctionFee, cost, XLM_FEE_MAX );
  
    } catch (err: any) {
      return response.json({
        message: typeof err.message === 'string' ? err.message : 'Failed to process txFunctionFee',
        status: 402,
        turret: TURRET_ADDRESS,
        cost,
      }, {
        status: 402
      })
    }
  
    await TX_FUNCTIONS.put(txFunctionHash, txFunctionConcat, {metadata: {
      cost,
      payment: transactionHash,
      length: txFunctionBuffer.length,
      txFunctionSignerSecret,
      txFunctionSignerPublicKey,
    }})
  
    return response.json({
      hash: txFunctionHash,
      signer: txFunctionSignerPublicKey,
    })
  }

  static async run({ request, params, env }: { request: Request, params: { txFunctionHash: string } , env: EnvProps}) {
    const { 
      TX_FUNCTIONS, 
      TX_FEES, 
      META, 
      TURRET_RUN_URL, 
      TURRET_SIGNER, 
      STELLAR_NETWORK, 
      HORIZON_URL, 
      RUN_DIVISOR 
    } = env
    const { txFunctionHash } = params
    if (!TX_FUNCTIONS || !META || !TURRET_SIGNER || !RUN_DIVISOR) return;
    const { value, metadata }: {value: ArrayBuffer | null, metadata:any} = await TX_FUNCTIONS.getWithMetadata(txFunctionHash, 'arrayBuffer')
  
    if (!value)
      throw {status: 404, message: `txFunction could not be found this turret`}
  
    const { length, txFunctionSignerPublicKey, txFunctionSignerSecret } = metadata
  
    const txFunctionBuffer = Buffer.from(value)
    const txFunction = txFunctionBuffer.slice(0, length).toString()
  
    const body = await request.json()
    const feeToken = request.headers.get('authorization')?.split(' ')?.[1]
  
    const AuthTx = authTxToken(STELLAR_NETWORK, feeToken)
    if (!AuthTx) return;

    const { 
      hash: authedHash,
      publicKey: authedPublicKey, 
      data: authedContracts,
      singleUse,
      exp
    } = AuthTx;
  
    // if no contracts are specified in the auth token, allow any contract to be run
    if (
      authedContracts.length
      && !authedContracts.some(hash => hash === txFunctionHash)
    ) throw { status: 403, message: `Not authorized to run contract with hash ${txFunctionHash}` }
  
    const txFeesId = TX_FEES.idFromName(authedPublicKey)
    const txFeesStub = TX_FEES.get(txFeesId)
  
    if (singleUse) { // If auth token is single use check if it's already been used
      await txFeesStub.fetch(`/${authedHash}`, {method: 'POST'}).then(handleResponse)
      await META.put(`suat:${authedPublicKey}:${authedHash}`, Buffer.alloc(0), {metadata: exp})
    }
  
    const feeMetadata = await txFeesStub.fetch('/').then(handleResponse)
    
    let feeBalance
    
    if (feeMetadata) {
      feeBalance = new BigNumber(feeMetadata.balance)
  
      if (feeBalance.lessThanOrEqualTo(0)) {
        throw { status: 402, message: `Turret fees have been spent for account ${authedPublicKey}` }
      }
    } else {
      throw { status: 402, message: `No payment was found for account ${authedPublicKey}` }
    }
  
    let { 
      value: turretAuthData, 
      metadata: turretAuthSignature 
    }: {value: string | null, metadata:any } = await META.getWithMetadata('TURRET_AUTH_TOKEN')
  
    if (!turretAuthData) {
      const turretSignerKeypair = Keypair.fromSecret(TURRET_SIGNER)
      const turretAuthBuffer = crypto.getRandomValues(Buffer.alloc(256))
  
      turretAuthData = turretAuthBuffer.toString('base64')
      turretAuthSignature = turretSignerKeypair.sign(turretAuthBuffer).toString('base64')
  
      await META.put('TURRET_AUTH_TOKEN', turretAuthData, {
        expirationTtl: 2419200,
        metadata: turretAuthSignature
      })
    }
  
    const watch = new Stopwatch()
    const res = await fetch(`${TURRET_RUN_URL}/${txFunctionHash}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Turret-Data': turretAuthData,
        'X-Turret-Signature': turretAuthSignature,
      },
      body: JSON.stringify({
        ...body,
        HORIZON_URL,
        STELLAR_NETWORK,
        txFunction,
      })
    })
    .then(async (res) => {
      watch.mark('Ran txFunction')
  
      const cost = new BigNumber(watch.getTotalTime()).dividedBy(RUN_DIVISOR).toFixed(7)
      const xdr = await res.text();
      const { balance: feeBalanceRemaining } = await txFeesStub.fetch('/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          minus: cost
        })
      }).then(handleResponse)
  
      if (res.ok) return {
        xdr,
        cost,
        feeSponsor: authedPublicKey,
        feeBalanceRemaining,
      }
      
      const contentType = res.headers.get('content-type');
      if (!contentType) return;

      return {
        error: {
          status: res.status || 400,
          ...contentType.indexOf('json') > -1 ? await res.json() : await res.text()
        },
        cost,
        feeSponsor: authedPublicKey,
        feeBalanceRemaining,
      }
    })

    const { 
      xdr,
      error,
      cost,
      feeSponsor,
      feeBalanceRemaining
    } = res as { xdr?: any, error?: any, cost: any, feeSponsor: any, feeBalanceRemaining: any } ;
    if (error) {
      if (error.status === 403) // clear turret auth token cache on an auth failure 
        await META.delete('TURRET_AUTH_TOKEN')
  
      return response.json({
        ...error,
        cost,
        feeSponsor: authedPublicKey,
        feeBalanceRemaining,
      }, {
        status: error.status,
        stopwatch: watch,
      })
    }

    if (!xdr) return;

    const transaction = new Transaction(xdr, Networks[STELLAR_NETWORK])
  
    const txFunctionSignerKeypair = Keypair.fromSecret(txFunctionSignerSecret)
    const txFunctionSignature = txFunctionSignerKeypair.sign(transaction.hash()).toString('base64')
  
    return response.json({
      xdr,
      signer: txFunctionSignerPublicKey,
      signature: txFunctionSignature,
      cost,
      feeSponsor,
      feeBalanceRemaining,
    }, {
      stopwatch: watch,
    })
  }
}
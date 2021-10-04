import { Router } from 'tiny-request-router'
import { handleFees, handleRequest, handleScheduled } from './@utils'
import { Turret, TxFees } from './functions';

const router = new Router()

router
.get('/', Turret.details)
.get('/.well-known/stellar.toml', Turret.toml)
.get('/tx-fees', TxFees.get)
.post('/tx-fees/:publicKey', TxFees.pay)

exports.TxFees = handleFees
exports.handlers = {
  async fetch(request: Request, env: any, ctx: any) {
    try {
      return await handleRequest(router, request, env, ctx);
    } catch (e: any) {
      console.log('error response')
      return new Response(e.message)
    }
  },
  async scheduled(env: any) {
    try {
      return await handleScheduled(env)
    } catch (e: any) {
      return new Response(e.message)
    }
  },
}

export default exports;
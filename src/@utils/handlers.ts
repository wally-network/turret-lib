import { Router } from 'tiny-request-router';
import { RequestMethodsProps, EnvProps } from '../types'
import flushSingleUseAuthTokens from './flush-single-use-auth-tokens'
import { parseError } from './parseError';

export const handleRequest = async (router: Router,request: Request, env: EnvProps, ctx: any) => {  
  try {
    console.log('Handling Request')
    const cache = caches.default
    const method:RequestMethodsProps = request.method as RequestMethodsProps
    const { href, pathname } = new URL(request.url)
    if (method === 'OPTIONS')
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Authorization, Origin, Content-Type, Accept, Cache-Control, Pragma',
          'Access-Control-Allow-Methods': 'GET, PUT, POST, DELETE, PATCH, OPTIONS',
          'Cache-Control': 'public, max-age=2419200', // 28 days
        }
      })

    const routerMatch = router.match(method, pathname)

    if (routerMatch) {
      const routerResponse = await routerMatch.handler({
        ...routerMatch,
        cache,
        request,
        env,
        ctx
      })

      if (
        method === 'GET'
        && routerResponse.status >= 200
        && routerResponse.status <= 299
      ) ctx.waitUntil(cache.put(href, routerResponse.clone()))

      return routerResponse
    }

    throw {status: 404}
  }

  catch(err) {
    return parseError(err)
  }
}
export async function handleResponse(response: any) {
  response.json().then((item: any) => console.log(item))
  if (response.ok)
    return response.headers.get('content-type')?.indexOf('json') > -1
    ? response.json() 
    : response.text()

  throw response.headers.get('content-type')?.indexOf('json') > -1
  ? await response.json()
  : await response.text()
}

export function handleScheduled( env: { META: KVNamespace, TX_FEES: any}) {
  return Promise.all([flushSingleUseAuthTokens({ env })])
}

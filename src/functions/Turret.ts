declare const VERSION: string;
import { response } from 'cfw-easy-utils';
import { EnvProps } from '../types';

export class Turret {
  static async details({env}: { env: EnvProps}) {
    const { 
      TURRET_ADDRESS, 
      STELLAR_NETWORK, 
      HORIZON_URL, 
      TURRET_RUN_URL, 
      XLM_FEE_MIN,
      XLM_FEE_MAX,
      UPLOAD_DIVISOR, 
      RUN_DIVISOR 
    } = env;
    return response.json({
      turret: TURRET_ADDRESS,
      network: STELLAR_NETWORK,
      horizon: HORIZON_URL,
      runner: TURRET_RUN_URL,
      version: VERSION,
      fee: {
        min: XLM_FEE_MIN,
        max: XLM_FEE_MAX,
      },
      divisor: {
        upload: UPLOAD_DIVISOR, 
        run: RUN_DIVISOR
      },
    }, {
      headers: {
        'Cache-Control': 'public, max-age=300', // 5 minutes
      }
    })
  }

  static async toml({ env }: { env: { META: KVNamespace }}) {
    const { META } = env;
    const stellarToml = await META.get('STELLAR_TOML')
    if (!stellarToml)
      throw {status: 404, message: `stellar.toml file could not be found on this turret`}
  
    return response.text(stellarToml, {
      headers: {
        'Content-Type': 'text/plain',
        'Cache-Control': 'public, max-age=2419200', // 28 days
      }
    })
  }
}
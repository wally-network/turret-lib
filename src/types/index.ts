type RequestMethodsProps = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
type EnvProps = {
  TURRET_ADDRESS: string, 
  STELLAR_NETWORK: 'TESTNET' | 'PUBLIC', 
  HORIZON_URL?: string, 
  TURRET_RUN_URL?: string, 
  XLM_FEE_MIN?: number,
  XLM_FEE_MAX?: number,
  UPLOAD_DIVISOR?: number, 
  RUN_DIVISOR?: number,
  TURRET_SIGNER?: string;
  TX_FUNCTIONS?: KVNamespace,
  META?: KVNamespace,
  TX_FEES?: DurableObjectNamespace | any,
}
export { RequestMethodsProps, EnvProps };
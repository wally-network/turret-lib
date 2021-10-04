

/**
 * Helper functions for managing authentication against a Turret
 */
 import {BigNumber} from "bignumber.js";
import { Transaction, Networks } from 'stellar-base'
 import { verifyTxSignedBy } from './stellar-sdk-utils'
 import moment from 'moment';
 /**
  * Determine the authenticated user and contracts with the provided token.
  * 
  * @param {string} network The Stellar Network to validate the token on
  * @param {string} authToken - The provided auth token
  * 
  * @link https://tyvdh.github.io/stellar-tss/#section/Authentication
  * 
  *
  * @typedef {Object} AuthResult
  * @property {string} publicKey - The authenticated public key from the token.
  * @property {string[]} data - The data collected. Returns an empty array if no matching ManageData values are 
  *                             found
  *
  * @returns {AuthResult} - The result of the authentication
  */
 export function authTxToken(network: 'PUBLIC' | 'TESTNET', authToken: any) {
   try {
     if (authToken === undefined) {
       throw { message: 'Unable to find an auth token' };
     }
 
     const authTx: Transaction = new Transaction(authToken, Networks[network]);
 
     // validate tx structure
     if (!new BigNumber(authTx.sequence).equals(0)) {
       throw { message: `AuthTokenTx has a non-zero sequence number` };
     }

     // validate timeBounds presence
     if (!authTx.timeBounds) return;
     // validate token expiration     
     if (
       !new BigNumber(authTx.timeBounds.maxTime).equals(0) &&
       moment.utc(authTx.timeBounds.maxTime, 'X').isBefore()
     ) {
       throw { message: `AuthToken has expired` };
     }
 
     // ensure tx is signed
     const authPublicKey = authTx.source;
     if (!verifyTxSignedBy(authTx, authPublicKey)) {
       throw { message: `AuthToken not signed` };
     }
     
     let enteredData = [];
     let singleUse = false
 
     for (const op of authTx.operations) {
       if (op.type === 'manageData') {
         if(!op.value) return;
         let value = op.value.toString();
 
         if (op.name === 'singleUse')
           singleUse = value === 'true' ? true : false
 
         else if (op.name === 'txFunctionHash')
           enteredData.push(value)
       }
     }
 
     // if single use token maxTime cannot be more than 1 hour from now
     if (
       singleUse
       && (
         new BigNumber(authTx.timeBounds.maxTime).lessThanOrEqualTo(0)
         || moment.utc(authTx.timeBounds.maxTime, 'X').isAfter(moment.utc().add(1, 'hour'))
       )
     ) {
       throw { message: `Single use auth tokens must expire in less than 1 hour` };
     }
 
     return {
       hash: authTx.hash().toString('hex'),
       publicKey: authPublicKey,
       data: enteredData,
       singleUse,
       exp: authTx.timeBounds.maxTime
     }
   } catch (e: any) {
     throw { message: e.message != undefined ? `${e.message}: Failed during auth` : `Failed to parse Auth Token` }
   }
 }
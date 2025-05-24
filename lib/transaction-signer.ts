"use client"

import { deriveKeysFromMnemonic, clearSensitiveData } from './bitcoin-wallet'
import { getBlockchainService, UTXOInfo } from './blockchain-service'
import { sha256 } from '@noble/hashes/sha256'
import * as secp256k1 from '@noble/secp256k1'
import { hmac } from '@noble/hashes/hmac'
import * as bitcoin from 'bitcoinjs-lib'
import { ECPairFactory } from 'ecpair'
import * as ecc from 'tiny-secp256k1'

// Initialize ECPair with secp256k1 implementation
const ECPair = ECPairFactory(ecc)

// Configure secp256k1 for browser environment
if (typeof window !== 'undefined') {
  // Setup HMAC for browser environment
  secp256k1.etc.hmacSha256Sync = (key: Uint8Array, ...messages: Uint8Array[]) => {
    return hmac(sha256, key, secp256k1.etc.concatBytes(...messages))
  }
}

export interface TransactionInput {
  txid: string
  vout: number
  value: number
  scriptPubKey: string
}

export interface TransactionOutput {
  address: string
  value: number
}

export interface UnsignedTransaction {
  inputs: TransactionInput[]
  outputs: TransactionOutput[]
  fee: number
  network: 'testnet' | 'mainnet'
}

export interface SignedTransaction {
  txHex: string
  txid: string
  size: number
  virtualSize: number
  fee: number
}

// Bitcoin Script opcodes
const OP_DUP = 0x76
const OP_HASH160 = 0xa9
const OP_EQUALVERIFY = 0x88
const OP_CHECKSIG = 0xac

// Serialize integer as little-endian
function serializeUint32LE(value: number): Uint8Array {
  const buffer = new Uint8Array(4)
  buffer[0] = value & 0xff
  buffer[1] = (value >> 8) & 0xff
  buffer[2] = (value >> 16) & 0xff
  buffer[3] = (value >> 24) & 0xff
  return buffer
}

// Serialize integer as big-endian
function serializeUint64LE(value: number): Uint8Array {
  const buffer = new Uint8Array(8)
  const low = value >>> 0
  const high = Math.floor(value / 0x100000000)
  
  buffer[0] = low & 0xff
  buffer[1] = (low >> 8) & 0xff
  buffer[2] = (low >> 16) & 0xff
  buffer[3] = (low >> 24) & 0xff
  buffer[4] = high & 0xff
  buffer[5] = (high >> 8) & 0xff
  buffer[6] = (high >> 16) & 0xff
  buffer[7] = (high >> 24) & 0xff
  
  return buffer
}

// Serialize variable length integer
function serializeVarInt(value: number): Uint8Array {
  if (value < 0xfd) {
    return new Uint8Array([value])
  } else if (value <= 0xffff) {
    const buffer = new Uint8Array(3)
    buffer[0] = 0xfd
    buffer[1] = value & 0xff
    buffer[2] = (value >> 8) & 0xff
    return buffer
  } else if (value <= 0xffffffff) {
    const buffer = new Uint8Array(5)
    buffer[0] = 0xfe
    buffer[1] = value & 0xff
    buffer[2] = (value >> 8) & 0xff
    buffer[3] = (value >> 16) & 0xff
    buffer[4] = (value >> 24) & 0xff
    return buffer
  } else {
    const buffer = new Uint8Array(9)
    buffer[0] = 0xff
    const low = value >>> 0
    const high = Math.floor(value / 0x100000000)
    buffer[1] = low & 0xff
    buffer[2] = (low >> 8) & 0xff
    buffer[3] = (low >> 16) & 0xff
    buffer[4] = (low >> 24) & 0xff
    buffer[5] = high & 0xff
    buffer[6] = (high >> 8) & 0xff
    buffer[7] = (high >> 16) & 0xff
    buffer[8] = (high >> 24) & 0xff
    return buffer
  }
}

// Convert hex string to Uint8Array
function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
}

// Convert Uint8Array to hex string
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

// Reverse byte order for Bitcoin's little-endian format
function reverseBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes.reverse())
}

export class TransactionSigner {
  private bitcoinNetwork: bitcoin.Network

  constructor(private network: 'testnet' | 'mainnet') {
    this.bitcoinNetwork = network === 'testnet' ? bitcoin.networks.testnet : bitcoin.networks.bitcoin
  }

  // 🔑 SECURE: Create and sign transaction with temporary key derivation
  async createAndSignTransaction(
    mnemonic: string,
    derivationPath: string,
    recipientAddress: string,
    amount: number, // in BTC
    feeRate: number, // satoshis per vbyte
    walletAddress: string
  ): Promise<SignedTransaction> {
    let keys: any = null
    
    try {
      // 🔑 TEMPORARY: Derive keys from mnemonic
      keys = await deriveKeysFromMnemonic(mnemonic, derivationPath, this.network)
      
      // Verify the derived address matches wallet address
      if (keys.address !== walletAddress) {
        throw new Error('Derived address does not match wallet address')
      }

      // Get UTXOs for the address
      const blockchainService = getBlockchainService(this.network)
      const utxos = await blockchainService.getAddressUTXOs(walletAddress)
      
      if (utxos.length === 0) {
        throw new Error('No UTXOs available for transaction')
      }

      // Convert amount from BTC to satoshis
      const amountSatoshis = Math.floor(amount * 100000000)
      
      // Select UTXOs and calculate fee
      const { selectedUtxos, totalInput, fee } = this.selectUtxos(utxos, amountSatoshis, feeRate)
      
      if (totalInput < amountSatoshis + fee) {
        throw new Error('Insufficient funds for transaction')
      }

      // Create transaction using bitcoinjs-lib
      const tx = new bitcoin.Transaction()
      tx.version = 2
      
      // Add inputs
      for (const utxo of selectedUtxos) {
        tx.addInput(Buffer.from(utxo.txid, 'hex').reverse(), utxo.vout)
      }

      // Add recipient output
      tx.addOutput(bitcoin.address.toOutputScript(recipientAddress, this.bitcoinNetwork), amountSatoshis)

      // Add change output if needed
      const change = totalInput - amountSatoshis - fee
      if (change > 546) { // Dust threshold
        tx.addOutput(bitcoin.address.toOutputScript(walletAddress, this.bitcoinNetwork), change)
      }

      // Sign inputs
      const keyPair = ECPair.fromPrivateKey(Buffer.from(keys.privateKey, 'hex'))
      const hashType = bitcoin.Transaction.SIGHASH_ALL
      
      for (let i = 0; i < selectedUtxos.length; i++) {
        const utxo = selectedUtxos[i]
        const scriptPubKey = bitcoin.address.toOutputScript(walletAddress, this.bitcoinNetwork)
        const signatureHash = tx.hashForSignature(i, scriptPubKey, hashType)
        const signature = keyPair.sign(signatureHash)
        const scriptSig = bitcoin.script.compile([
          Buffer.concat([signature, Buffer.from([hashType])]),
          Buffer.from(keyPair.publicKey)
        ])
        tx.setInputScript(i, scriptSig)
      }
      
      const txHex = tx.toHex()
      
      return {
        txHex,
        txid: tx.getId(),
        size: tx.byteLength(),
        virtualSize: tx.virtualSize(),
        fee
      }

    } catch (error) {
      console.error('Transaction creation failed:', error)
      throw error
    } finally {
      // 🔥 SECURITY: Clear sensitive data from memory
      if (keys) {
        clearSensitiveData(keys)
        keys = null
      }
      
      // Force garbage collection hint
      if (global.gc) {
        global.gc()
      }
    }
  }

  private async getRawTransaction(txid: string): Promise<string> {
    try {
      // For now, create a simple mock raw transaction since we're using PSBT
      // This is a temporary workaround - real implementation would fetch from blockchain
      console.warn(`Warning: Using mock raw transaction for ${txid}`)
      
      // Create a minimal valid raw transaction structure
      // In a real implementation, this would fetch the actual transaction from the blockchain
      const mockRawTx = '0200000001' + // version
                       txid.match(/.{2}/g)?.reverse().join('') + // reversed txid  
                       '00000000' + // vout (placeholder)
                       '1976a914' + // scriptSig start (P2PKH)
                       '0'.repeat(40) + // placeholder pubkey hash
                       '88ac' + // scriptSig end
                       'ffffffff' + // sequence
                       '01' + // output count
                       '0000000000000000' + // value (placeholder)
                       '1976a914' + // scriptPubKey start
                       '0'.repeat(40) + // placeholder address hash
                       '88ac' + // scriptPubKey end
                       '00000000' // locktime
      
      return mockRawTx
    } catch (error) {
      console.error('Failed to get raw transaction:', error)
      throw new Error('Failed to fetch transaction data for UTXO')
    }
  }

  private selectUtxos(utxos: UTXOInfo[], targetAmount: number, feeRate: number): {
    selectedUtxos: UTXOInfo[]
    totalInput: number
    fee: number
  } {
    // Sort UTXOs by value (largest first for efficiency)
    const sortedUtxos = [...utxos].sort((a, b) => b.value - a.value)
    
    const selectedUtxos: UTXOInfo[] = []
    let totalInput = 0
    
    for (const utxo of sortedUtxos) {
      selectedUtxos.push(utxo)
      totalInput += utxo.value
      
      // Calculate fee with current number of inputs
      // P2PKH inputs: 148 bytes, outputs: 34 bytes, base: 10 bytes
      const estimatedSize = (selectedUtxos.length * 148) + (2 * 34) + 10
      const fee = Math.ceil(estimatedSize * feeRate)
      
      if (totalInput >= targetAmount + fee) {
        return { selectedUtxos, totalInput, fee }
      }
    }
    
    // If we get here, insufficient funds
    const estimatedSize = (selectedUtxos.length * 148) + (2 * 34) + 10
    const fee = Math.ceil(estimatedSize * feeRate)
    
    return { selectedUtxos, totalInput, fee }
  }
}

// Factory function for creating transaction signer
export function createTransactionSigner(network: 'testnet' | 'mainnet'): TransactionSigner {
  return new TransactionSigner(network)
} 
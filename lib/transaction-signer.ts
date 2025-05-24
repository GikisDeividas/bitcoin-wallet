"use client"

import { deriveKeysFromMnemonic, clearSensitiveData } from './bitcoin-wallet'
import { getBlockchainService, UTXOInfo } from './blockchain-service'
import { sha256 } from '@noble/hashes/sha256'
import * as secp256k1 from '@noble/secp256k1'
import { hmac } from '@noble/hashes/hmac'

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
  constructor(private network: 'testnet' | 'mainnet') {}

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

      // Create transaction inputs and outputs
      const inputs: TransactionInput[] = selectedUtxos.map(utxo => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
        scriptPubKey: this.createP2PKHScript(keys.address)
      }))

      const outputs: TransactionOutput[] = [
        {
          address: recipientAddress,
          value: amountSatoshis
        }
      ]

      // Add change output if needed
      const change = totalInput - amountSatoshis - fee
      if (change > 546) { // Dust threshold
        outputs.push({
          address: walletAddress,
          value: change
        })
      }

      // Create unsigned transaction
      const unsignedTx: UnsignedTransaction = {
        inputs,
        outputs,
        fee,
        network: this.network
      }

      // Sign the transaction
      const signedTx = await this.signTransaction(unsignedTx, keys.privateKey)
      
      return signedTx

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

  private selectUtxos(utxos: UTXOInfo[], targetAmount: number, feeRate: number): {
    selectedUtxos: UTXOInfo[]
    totalInput: number
    fee: number
  } {
    // Sort UTXOs by value (largest first for efficiency)
    const sortedUtxos = [...utxos].sort((a, b) => b.value - a.value)
    
    const selectedUtxos: UTXOInfo[] = []
    let totalInput = 0
    
    // Estimate transaction size (inputs * 148 + outputs * 34 + 10 base bytes)
    const estimatedSize = (selectedUtxos.length * 148) + (2 * 34) + 10 // Assume 2 outputs max
    let fee = Math.ceil(estimatedSize * feeRate)
    
    for (const utxo of sortedUtxos) {
      selectedUtxos.push(utxo)
      totalInput += utxo.value
      
      // Recalculate fee with current number of inputs
      const currentSize = (selectedUtxos.length * 148) + (2 * 34) + 10
      fee = Math.ceil(currentSize * feeRate)
      
      if (totalInput >= targetAmount + fee) {
        break
      }
    }
    
    return { selectedUtxos, totalInput, fee }
  }

  private createP2PKHScript(address: string): string {
    // This is a simplified P2PKH script creation
    // In a production app, you'd want proper address parsing
    return 'p2pkh' // Placeholder for now
  }

  private async signTransaction(unsignedTx: UnsignedTransaction, privateKey: string): Promise<SignedTransaction> {
    // Create the raw transaction
    const rawTx = this.createRawTransaction(unsignedTx)
    
    // For each input, create signature
    const signedInputs: Uint8Array[] = []
    
    for (let i = 0; i < unsignedTx.inputs.length; i++) {
      const signature = await this.signInput(rawTx, i, unsignedTx.inputs[i], privateKey)
      signedInputs.push(signature)
    }

    // Assemble final transaction
    const signedTxHex = this.assembleFinalTransaction(unsignedTx, signedInputs, privateKey)
    
    // Calculate transaction hash
    const txBytes = hexToBytes(signedTxHex)
    const hash1 = sha256(txBytes)
    const hash2 = sha256(hash1)
    const txid = bytesToHex(reverseBytes(hash2))

    return {
      txHex: signedTxHex,
      txid,
      size: txBytes.length,
      virtualSize: Math.ceil(txBytes.length), // Simplified, real calculation is more complex
      fee: unsignedTx.fee
    }
  }

  private createRawTransaction(unsignedTx: UnsignedTransaction): Uint8Array {
    const parts: Uint8Array[] = []
    
    // Version (4 bytes, little-endian)
    parts.push(serializeUint32LE(2))
    
    // Input count
    parts.push(serializeVarInt(unsignedTx.inputs.length))
    
    // Inputs
    for (const input of unsignedTx.inputs) {
      // Previous transaction hash (32 bytes, reversed)
      parts.push(reverseBytes(hexToBytes(input.txid)))
      
      // Previous output index (4 bytes, little-endian)
      parts.push(serializeUint32LE(input.vout))
      
      // Script length (empty for unsigned)
      parts.push(new Uint8Array([0]))
      
      // Sequence (4 bytes, little-endian)
      parts.push(serializeUint32LE(0xffffffff))
    }
    
    // Output count
    parts.push(serializeVarInt(unsignedTx.outputs.length))
    
    // Outputs
    for (const output of unsignedTx.outputs) {
      // Value (8 bytes, little-endian)
      parts.push(serializeUint64LE(output.value))
      
      // Script (simplified P2PKH)
      const script = this.createOutputScript(output.address)
      parts.push(serializeVarInt(script.length))
      parts.push(script)
    }
    
    // Locktime (4 bytes, little-endian)
    parts.push(serializeUint32LE(0))
    
    // Concatenate all parts
    const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0
    
    for (const part of parts) {
      result.set(part, offset)
      offset += part.length
    }
    
    return result
  }

  private createOutputScript(address: string): Uint8Array {
    // Simplified P2PKH script creation
    // In production, you'd parse the address properly
    const script = new Uint8Array(25)
    script[0] = OP_DUP
    script[1] = OP_HASH160
    script[2] = 20 // hash160 length
    // script[3-22] would be the hash160 of the public key
    script[23] = OP_EQUALVERIFY
    script[24] = OP_CHECKSIG
    return script
  }

  private async signInput(
    rawTx: Uint8Array, 
    inputIndex: number, 
    input: TransactionInput, 
    privateKey: string
  ): Promise<Uint8Array> {
    // Create signature hash for this input
    const signatureHash = sha256(sha256(rawTx))
    
    // Sign with private key
    const privateKeyBytes = hexToBytes(privateKey)
    const signature = await secp256k1.sign(signatureHash, privateKeyBytes)
    
    // Add SIGHASH_ALL flag
    const sigWithHashType = new Uint8Array(signature.toCompactRawBytes().length + 1)
    sigWithHashType.set(signature.toCompactRawBytes())
    sigWithHashType[sigWithHashType.length - 1] = 0x01 // SIGHASH_ALL
    
    return sigWithHashType
  }

  private assembleFinalTransaction(
    unsignedTx: UnsignedTransaction, 
    signatures: Uint8Array[], 
    privateKey: string
  ): string {
    // This is a simplified assembly
    // In production, you'd properly construct the scriptSig for each input
    return 'simplified_transaction_hex' // Placeholder
  }
}

// Factory function for creating transaction signer
export function createTransactionSigner(network: 'testnet' | 'mainnet'): TransactionSigner {
  return new TransactionSigner(network)
} 
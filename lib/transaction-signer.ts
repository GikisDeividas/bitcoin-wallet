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

// Helper functions for Bitcoin transaction creation
function serializeUint32LE(value: number): Uint8Array {
  const buffer = new Uint8Array(4)
  buffer[0] = value & 0xff
  buffer[1] = (value >> 8) & 0xff
  buffer[2] = (value >> 16) & 0xff
  buffer[3] = (value >> 24) & 0xff
  return buffer
}

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

function serializeVarInt(value: number): Uint8Array {
  if (value < 0xfd) {
    return new Uint8Array([value])
  } else if (value <= 0xffff) {
    const buffer = new Uint8Array(3)
    buffer[0] = 0xfd
    buffer[1] = value & 0xff
    buffer[2] = (value >> 8) & 0xff
    return buffer
  } else {
    const buffer = new Uint8Array(5)
    buffer[0] = 0xfe
    buffer[1] = value & 0xff
    buffer[2] = (value >> 8) & 0xff
    buffer[3] = (value >> 16) & 0xff
    buffer[4] = (value >> 24) & 0xff
    return buffer
  }
}

function hexToBytes(hex: string): Uint8Array {
  return new Uint8Array(hex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)))
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('')
}

function reverseBytes(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes.reverse())
}

// Base58 decoding for address parsing
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function base58Decode(s: string): Uint8Array {
  try {
    let num = BigInt(0)
    const base = BigInt(58)
    
    for (let i = 0; i < s.length; i++) {
      const char = s[i]
      const charIndex = BASE58_ALPHABET.indexOf(char)
      if (charIndex === -1) throw new Error(`Invalid base58 character: ${char}`)
      num = num * base + BigInt(charIndex)
    }
    
    // Convert to bytes
    const bytes: number[] = []
    while (num > 0) {
      bytes.unshift(Number(num % BigInt(256)))
      num = num / BigInt(256)
    }
    
    // Add leading zeros
    for (let i = 0; i < s.length && s[i] === '1'; i++) {
      bytes.unshift(0)
    }
    
    return new Uint8Array(bytes)
  } catch (error) {
    console.error('Base58 decode error:', error)
    throw new Error(`Failed to decode base58 string: ${s}`)
  }
}

function decodeAddress(address: string, network: 'testnet' | 'mainnet'): Uint8Array {
  try {
    console.log('🔍 Decoding address:', address, 'for network:', network)
    
    if (!address || typeof address !== 'string') {
      throw new Error('Address must be a non-empty string')
    }
    
    const decoded = base58Decode(address)
    if (decoded.length !== 25) {
      throw new Error(`Invalid address length: ${decoded.length}, expected 25`)
    }
    
    const version = decoded[0]
    const expectedVersions = network === 'testnet' ? [0x6f, 0x71] : [0x00, 0x05]
    
    if (!expectedVersions.includes(version)) {
      throw new Error(`Invalid address version ${version} for ${network} network`)
    }
    
    // Remove version byte and checksum to get the hash160
    const hash160 = decoded.slice(1, 21)
    console.log('✅ Address decoded successfully, hash160 length:', hash160.length)
    return hash160
  } catch (error) {
    console.error('Address decode error:', error)
    throw new Error(`Invalid Bitcoin address: ${address} - ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
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
      console.log('🔧 Transaction Signer: Starting transaction creation')
      console.log('📍 Parameters:', {
        recipientAddress,
        amount,
        feeRate,
        walletAddress,
        network: this.network,
        derivationPath
      })

      // Phase 1: Key Derivation
      console.log('🔑 PHASE 1: Deriving keys from mnemonic...')
      try {
        keys = await deriveKeysFromMnemonic(mnemonic, derivationPath, this.network)
        console.log('✅ Key derivation successful')
      } catch (error) {
        console.error('❌ PHASE 1 FAILED: Key derivation error:', error)
        throw new Error(`Key derivation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
      
      // Phase 2: Address Verification
      console.log('🔑 PHASE 2: Verifying derived address...')
      try {
        if (keys.address !== walletAddress) {
          throw new Error(`Derived address ${keys.address} does not match wallet address ${walletAddress}`)
        }
        console.log('✅ Address verification passed')
      } catch (error) {
        console.error('❌ PHASE 2 FAILED: Address verification error:', error)
        throw error
      }

      // Phase 3: UTXO Fetching
      console.log('📊 PHASE 3: Fetching UTXOs for address:', walletAddress)
      let utxos: UTXOInfo[]
      try {
        const blockchainService = getBlockchainService(this.network)
        utxos = await blockchainService.getAddressUTXOs(walletAddress)
        
        if (utxos.length === 0) {
          throw new Error('No UTXOs available for transaction')
        }
        console.log(`✅ Found ${utxos.length} UTXOs:`, utxos.map(u => ({ txid: u.txid.slice(0,8) + '...', vout: u.vout, value: u.value })))
      } catch (error) {
        console.error('❌ PHASE 3 FAILED: UTXO fetching error:', error)
        throw new Error(`UTXO fetching failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }

      // Phase 4: Amount and Fee Calculation
      console.log('💰 PHASE 4: Calculating amounts and fees...')
      const amountSatoshis = Math.floor(amount * 100000000)
      console.log(`💰 Amount: ${amount} BTC = ${amountSatoshis} satoshis`)
      
      let selectedUtxos: UTXOInfo[], totalInput: number, fee: number
      try {
        const utxoSelection = this.selectUtxos(utxos, amountSatoshis, feeRate)
        selectedUtxos = utxoSelection.selectedUtxos
        totalInput = utxoSelection.totalInput
        fee = utxoSelection.fee
        
        if (totalInput < amountSatoshis + fee) {
          throw new Error(`Insufficient funds: need ${amountSatoshis + fee} satoshis, have ${totalInput} satoshis`)
        }
        console.log(`✅ Selected ${selectedUtxos.length} UTXOs, total input: ${totalInput} satoshis, fee: ${fee} satoshis`)
      } catch (error) {
        console.error('❌ PHASE 4 FAILED: UTXO selection error:', error)
        throw new Error(`UTXO selection failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }

      // Phase 5: Transaction Structure Creation
      console.log('🏗️ PHASE 5: Creating unsigned transaction structure...')
      let unsignedTx: UnsignedTransaction
      try {
        unsignedTx = {
          inputs: selectedUtxos.map(utxo => ({
            txid: utxo.txid,
            vout: utxo.vout,
            value: utxo.value,
            scriptPubKey: this.createP2PKHScript(walletAddress)
          })),
          outputs: [
            {
              address: recipientAddress,
              value: amountSatoshis
            }
          ],
          fee,
          network: this.network
        }

        // Add change output if needed
        const change = totalInput - amountSatoshis - fee
        if (change > 546) { // Dust threshold
          console.log(`💱 Adding change output: ${change} satoshis`)
          unsignedTx.outputs.push({
            address: walletAddress,
            value: change
          })
        }
        
        console.log('✅ Transaction structure created:', {
          inputs: unsignedTx.inputs.length,
          outputs: unsignedTx.outputs.length,
          totalFee: unsignedTx.fee
        })
      } catch (error) {
        console.error('❌ PHASE 5 FAILED: Transaction structure creation error:', error)
        throw new Error(`Transaction structure creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }

      // Phase 6: Transaction Signing
      console.log('✍️ PHASE 6: Signing transaction...')
      let signedTx: SignedTransaction
      try {
        signedTx = await this.signTransaction(unsignedTx, keys.privateKey)
        console.log('✅ Transaction signed successfully:', {
          txid: signedTx.txid,
          size: signedTx.size,
          fee: signedTx.fee,
          txHex: signedTx.txHex.slice(0, 100) + '...'
        })
      } catch (error) {
        console.error('❌ PHASE 6 FAILED: Transaction signing error:', error)
        throw new Error(`Transaction signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
      
      return signedTx

    } catch (error) {
      console.error('❌ Transaction creation failed:', error)
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : 'No stack',
        recipientAddress,
        amount,
        walletAddress
      })
      throw error
    } finally {
      // 🔥 SECURITY: Clear sensitive data from memory
      if (keys) {
        console.log('🧹 Clearing sensitive data from memory')
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

  private createP2PKHScript(address: string): string {
    try {
      const hash160 = decodeAddress(address, this.network)
      return '76a914' + bytesToHex(hash160) + '88ac' // OP_DUP OP_HASH160 <hash> OP_EQUALVERIFY OP_CHECKSIG
    } catch (error) {
      throw new Error('Failed to create script for address: ' + address)
    }
  }

  private createOutputScript(address: string): Uint8Array {
    try {
      const hash160 = decodeAddress(address, this.network)
      const script = new Uint8Array(25)
      script[0] = 0x76 // OP_DUP
      script[1] = 0xa9 // OP_HASH160
      script[2] = 20   // hash160 length
      script.set(hash160, 3)
      script[23] = 0x88 // OP_EQUALVERIFY
      script[24] = 0xac // OP_CHECKSIG
      return script
    } catch (error) {
      throw new Error('Failed to create output script for address: ' + address)
    }
  }

  private async signTransaction(unsignedTx: UnsignedTransaction, privateKey: string): Promise<SignedTransaction> {
    // Create the raw transaction
    const rawTx = this.createRawTransaction(unsignedTx)
    
    // Sign each input
    const signedInputs: { signature: Uint8Array; publicKey: Uint8Array }[] = []
    const privateKeyBytes = hexToBytes(privateKey)
    const publicKeyBytes = secp256k1.getPublicKey(privateKeyBytes, true) // compressed
    
    for (let i = 0; i < unsignedTx.inputs.length; i++) {
      const input = unsignedTx.inputs[i]
      
      // Create signature hash for this input
      const txForSigning = this.createTxForSigning(unsignedTx, i, input.scriptPubKey)
      const hash = sha256(sha256(txForSigning))
      
      console.log(`🔐 Signing input ${i}, hash:`, bytesToHex(hash))
      
      // Sign with private key using noble
      const signature = await secp256k1.sign(hash, privateKeyBytes)
      
      // Ensure signature is canonical (s value in lower half)
      const canonicalSignature = signature.normalizeS()
      
      // Convert to compact format first (64 bytes: 32-byte r + 32-byte s)
      const compactSig = canonicalSignature.toCompactRawBytes()
      
      // Bitcoin requires DER format, so we need to encode it properly
      const derSignature = this.encodeToDER(compactSig)
      
      console.log(`✅ Input ${i} signature DER length:`, derSignature.length)
      console.log(`✅ Input ${i} signature DER:`, bytesToHex(derSignature))
      
      signedInputs.push({
        signature: derSignature,
        publicKey: publicKeyBytes
      })
    }

    // Assemble final transaction
    const signedTxHex = this.assembleFinalTransaction(unsignedTx, signedInputs)
    
    // Calculate transaction hash
    const txBytes = hexToBytes(signedTxHex)
    const hash1 = sha256(txBytes)
    const hash2 = sha256(hash1)
    const txid = bytesToHex(reverseBytes(hash2))

    return {
      txHex: signedTxHex,
      txid,
      size: txBytes.length,
      virtualSize: Math.ceil(txBytes.length), // Simplified calculation
      fee: unsignedTx.fee
    }
  }

  // Convert compact signature (64 bytes) to DER format
  private encodeToDER(compactSig: Uint8Array): Uint8Array {
    // Extract r and s from compact signature
    const r = compactSig.slice(0, 32)
    const s = compactSig.slice(32, 64)
    
    // Encode r as DER integer
    const rDer = this.encodeIntegerDER(r)
    
    // Encode s as DER integer  
    const sDer = this.encodeIntegerDER(s)
    
    // Build full DER signature
    // Format: 0x30 [total-length] [rDer] [sDer]
    const totalLength = rDer.length + sDer.length
    const derSig = new Uint8Array(2 + totalLength)
    
    derSig[0] = 0x30 // SEQUENCE tag
    derSig[1] = totalLength // total length
    derSig.set(rDer, 2)
    derSig.set(sDer, 2 + rDer.length)
    
    return derSig
  }

  // Encode a 32-byte bigint as DER INTEGER
  private encodeIntegerDER(value: Uint8Array): Uint8Array {
    // Remove leading zeros but keep at least one byte
    let start = 0
    while (start < value.length - 1 && value[start] === 0) {
      start++
    }
    
    const trimmed = value.slice(start)
    
    // If the first bit is set, we need to prepend 0x00 to make it positive
    const needsPadding = (trimmed[0] & 0x80) !== 0
    const length = trimmed.length + (needsPadding ? 1 : 0)
    
    const result = new Uint8Array(2 + length)
    result[0] = 0x02 // INTEGER tag
    result[1] = length // length
    
    if (needsPadding) {
      result[2] = 0x00
      result.set(trimmed, 3)
    } else {
      result.set(trimmed, 2)
    }
    
    return result
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
      
      // Script
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

  private createTxForSigning(unsignedTx: UnsignedTransaction, inputIndex: number, scriptPubKey: string): Uint8Array {
    const parts: Uint8Array[] = []
    
    // Version
    parts.push(serializeUint32LE(2))
    
    // Input count
    parts.push(serializeVarInt(unsignedTx.inputs.length))
    
    // Inputs
    for (let i = 0; i < unsignedTx.inputs.length; i++) {
      const input = unsignedTx.inputs[i]
      
      // Previous transaction hash (reversed)
      parts.push(reverseBytes(hexToBytes(input.txid)))
      
      // Previous output index
      parts.push(serializeUint32LE(input.vout))
      
      // Script (only for the input being signed)
      if (i === inputIndex) {
        const script = hexToBytes(scriptPubKey)
        parts.push(serializeVarInt(script.length))
        parts.push(script)
      } else {
        parts.push(new Uint8Array([0])) // Empty script for other inputs
      }
      
      // Sequence
      parts.push(serializeUint32LE(0xffffffff))
    }
    
    // Outputs
    parts.push(serializeVarInt(unsignedTx.outputs.length))
    
    for (const output of unsignedTx.outputs) {
      parts.push(serializeUint64LE(output.value))
      const script = this.createOutputScript(output.address)
      parts.push(serializeVarInt(script.length))
      parts.push(script)
    }
    
    // Locktime
    parts.push(serializeUint32LE(0))
    
    // SIGHASH_ALL
    parts.push(serializeUint32LE(0x01))
    
    // Concatenate
    const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0
    
    for (const part of parts) {
      result.set(part, offset)
      offset += part.length
    }
    
    return result
  }

  private assembleFinalTransaction(
    unsignedTx: UnsignedTransaction, 
    signedInputs: { signature: Uint8Array; publicKey: Uint8Array }[]
  ): string {
    const parts: Uint8Array[] = []
    
    // Version
    parts.push(serializeUint32LE(2))
    
    // Input count
    parts.push(serializeVarInt(unsignedTx.inputs.length))
    
    // Inputs with signatures
    for (let i = 0; i < unsignedTx.inputs.length; i++) {
      const input = unsignedTx.inputs[i]
      const signedInput = signedInputs[i]
      
      // Previous transaction hash (reversed)
      parts.push(reverseBytes(hexToBytes(input.txid)))
      
      // Previous output index
      parts.push(serializeUint32LE(input.vout))
      
      // Script sig (signature + public key)
      const sigWithHashType = new Uint8Array(signedInput.signature.length + 1)
      sigWithHashType.set(signedInput.signature)
      sigWithHashType[signedInput.signature.length] = 0x01 // SIGHASH_ALL
      
      const scriptSig = new Uint8Array(
        1 + sigWithHashType.length + 1 + signedInput.publicKey.length
      )
      let offset = 0
      
      // Signature length + signature
      scriptSig[offset++] = sigWithHashType.length
      scriptSig.set(sigWithHashType, offset)
      offset += sigWithHashType.length
      
      // Public key length + public key
      scriptSig[offset++] = signedInput.publicKey.length
      scriptSig.set(signedInput.publicKey, offset)
      
      parts.push(serializeVarInt(scriptSig.length))
      parts.push(scriptSig)
      
      // Sequence
      parts.push(serializeUint32LE(0xffffffff))
    }
    
    // Outputs
    parts.push(serializeVarInt(unsignedTx.outputs.length))
    
    for (const output of unsignedTx.outputs) {
      parts.push(serializeUint64LE(output.value))
      const script = this.createOutputScript(output.address)
      parts.push(serializeVarInt(script.length))
      parts.push(script)
    }
    
    // Locktime
    parts.push(serializeUint32LE(0))
    
    // Concatenate all parts
    const totalLength = parts.reduce((sum, part) => sum + part.length, 0)
    const result = new Uint8Array(totalLength)
    let offset = 0
    
    for (const part of parts) {
      result.set(part, offset)
      offset += part.length
    }
    
    return bytesToHex(result)
  }
}

// Factory function for creating transaction signer
export function createTransactionSigner(network: 'testnet' | 'mainnet'): TransactionSigner {
  return new TransactionSigner(network)
} 
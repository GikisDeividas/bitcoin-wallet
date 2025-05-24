"use client"

import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english'
import { HDKey } from '@scure/bip32'
import { sha256 } from '@noble/hashes/sha256'
import { ripemd160 } from '@noble/hashes/ripemd160'
import { hmac } from '@noble/hashes/hmac'
import * as secp256k1 from '@noble/secp256k1'

// Configure secp256k1 for browser environment
if (typeof window !== 'undefined') {
  // Setup HMAC for browser environment to fix hmacSha256Sync error
  secp256k1.etc.hmacSha256Sync = (key: Uint8Array, ...messages: Uint8Array[]) => {
    return hmac(sha256, key, secp256k1.etc.concatBytes(...messages))
  }
}

export interface GeneratedWallet {
  mnemonic: string
  address: string
  network: 'testnet' | 'mainnet'
  derivationPath: string
}

export interface WalletKeys {
  privateKey: string
  publicKey: string
  address: string
}

// Base58 alphabet for Bitcoin
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

// Base58 encoding implementation
function base58Encode(input: Uint8Array): string {
  if (input.length === 0) return ''
  
  let num = BigInt(0)
  for (let i = 0; i < input.length; i++) {
    num = num * BigInt(256) + BigInt(input[i])
  }
  
  let result = ''
  while (num > 0) {
    result = BASE58_ALPHABET[Number(num % BigInt(58))] + result
    num = num / BigInt(58)
  }
  
  // Add leading zeros as '1's
  for (let i = 0; i < input.length && input[i] === 0; i++) {
    result = '1' + result
  }
  
  return result
}

// Calculate Bitcoin address hash160 (SHA256 + RIPEMD160)
function hash160Fn(data: Uint8Array): Uint8Array {
  return ripemd160(sha256(data))
}

// Calculate Bitcoin checksum (double SHA256, first 4 bytes)
function calculateChecksum(data: Uint8Array): Uint8Array {
  const hash1 = sha256(data)
  const hash2 = sha256(hash1)
  return hash2.slice(0, 4)
}

// Generate Bitcoin address from public key
function generateBitcoinAddress(publicKey: Uint8Array, network: 'testnet' | 'mainnet'): string {
  // Calculate hash160 of the public key
  const pubKeyHash = hash160Fn(publicKey)
  
  // Add version byte (0x6f for testnet P2PKH, 0x00 for mainnet P2PKH)
  const versionByte = network === 'testnet' ? 0x6f : 0x00
  const versionedHash = new Uint8Array(21)
  versionedHash[0] = versionByte
  versionedHash.set(pubKeyHash, 1)
  
  // Calculate checksum
  const checksum = calculateChecksum(versionedHash)
  
  // Combine version + hash + checksum
  const fullAddress = new Uint8Array(25)
  fullAddress.set(versionedHash, 0)
  fullAddress.set(checksum, 21)
  
  // Encode in base58
  return base58Encode(fullAddress)
}

// 🔐 SECURE: Generate wallet - returns mnemonic and address only (NO private keys stored)
export async function generateBitcoinWallet(network: 'testnet' | 'mainnet' = 'testnet'): Promise<GeneratedWallet> {
  // Generate proper 12-word mnemonic using @scure/bip39
  const mnemonic = generateMnemonic(wordlist, 128) // 128 bits = 12 words
  
  // Convert mnemonic to seed
  const seed = mnemonicToSeedSync(mnemonic)
  
  // Create HD wallet from seed
  const hdKey = HDKey.fromMasterSeed(seed)
  
  // Use appropriate derivation path based on network
  const coinType = network === 'testnet' ? "1'" : "0'"
  const derivationPath = `m/44'/${coinType}/0'/0/0` // BIP44 standard path
  const childKey = hdKey.derive(derivationPath)
  
  if (!childKey.publicKey) {
    throw new Error('Failed to derive public key')
  }
  
  // Generate address from public key
  const address = generateBitcoinAddress(childKey.publicKey, network)
  
  // 🔥 SECURITY: Private key is NOT returned - only exists in this scope and gets garbage collected
  
  return {
    mnemonic,
    address,
    network,
    derivationPath
  }
}

// 🔐 SECURE: Import wallet from mnemonic - returns address only (NO private keys stored)
export async function importWalletFromMnemonic(mnemonic: string, network: 'testnet' | 'mainnet' = 'testnet'): Promise<GeneratedWallet> {
  // Validate mnemonic using @scure/bip39
  if (!validateMnemonic(mnemonic, wordlist)) {
    throw new Error('Invalid mnemonic phrase')
  }
  
  // Convert mnemonic to seed
  const seed = mnemonicToSeedSync(mnemonic)
  
  // Create HD wallet from seed
  const hdKey = HDKey.fromMasterSeed(seed)
  
  // Use appropriate derivation path based on network
  const coinType = network === 'testnet' ? "1'" : "0'"
  const derivationPath = `m/44'/${coinType}/0'/0/0` // BIP44 standard path
  const childKey = hdKey.derive(derivationPath)
  
  if (!childKey.publicKey) {
    throw new Error('Failed to derive public key')
  }
  
  // Generate address from public key
  const address = generateBitcoinAddress(childKey.publicKey, network)
  
  // 🔥 SECURITY: Private key is NOT returned - only exists in this scope and gets garbage collected
  
  return {
    mnemonic,
    address,
    network,
    derivationPath
  }
}

// 🔑 TEMPORARY: Derive keys from mnemonic for transaction signing (keys burned after use)
export async function deriveKeysFromMnemonic(
  mnemonic: string, 
  derivationPath: string,
  network: 'testnet' | 'mainnet'
): Promise<WalletKeys> {
  // Validate mnemonic
  if (!validateMnemonic(mnemonic, wordlist)) {
    throw new Error('Invalid mnemonic phrase')
  }
  
  // Convert mnemonic to seed
  const seed = mnemonicToSeedSync(mnemonic)
  
  // Create HD wallet from seed
  const hdKey = HDKey.fromMasterSeed(seed)
  
  // Derive the specific key
  const childKey = hdKey.derive(derivationPath)
  
  if (!childKey.privateKey || !childKey.publicKey) {
    throw new Error('Failed to derive keys')
  }
  
  // Generate address
  const address = generateBitcoinAddress(childKey.publicKey, network)
  
  return {
    privateKey: Buffer.from(childKey.privateKey).toString('hex'),
    publicKey: Buffer.from(childKey.publicKey).toString('hex'),
    address
  }
}

// 🧹 SECURITY: Clear sensitive data from memory
export function clearSensitiveData(obj: any): void {
  if (obj && typeof obj === 'object') {
    Object.keys(obj).forEach(key => {
      if (key.includes('private') || key.includes('Private') || key.includes('mnemonic')) {
        // Overwrite with random data before deletion
        if (typeof obj[key] === 'string') {
          obj[key] = crypto.getRandomValues(new Uint8Array(obj[key].length)).join('')
        }
        delete obj[key]
      }
    })
  }
}

// Validate Bitcoin address format
export function isValidBitcoinAddress(address: string): boolean {
  // Testnet P2PKH addresses (start with 'm' or 'n')
  const testnetP2PKH = /^[mn][a-km-zA-HJ-NP-Z1-9]{25,34}$/
  // Testnet Bech32 addresses (start with 'tb1')
  const testnetBech32 = /^tb1[a-z0-9]{39,59}$/
  // Mainnet P2PKH addresses (start with '1' or '3')
  const mainnetP2PKH = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/
  // Mainnet Bech32 addresses (start with 'bc1')
  const mainnetBech32 = /^bc1[a-z0-9]{39,59}$/
  
  return testnetP2PKH.test(address) || testnetBech32.test(address) || 
         mainnetP2PKH.test(address) || mainnetBech32.test(address)
}

// Validate mnemonic phrase using @scure/bip39
export function isValidMnemonic(mnemonic: string): boolean {
  return validateMnemonic(mnemonic, wordlist)
}

// 🔑 EXPORT: Derive private key for wallet export (temporary access)
export async function exportPrivateKey(
  mnemonic: string,
  derivationPath: string,
  network: 'testnet' | 'mainnet',
  targetAddress: string
): Promise<{ privateKey: string; publicKey: string; address: string }> {
  // Validate mnemonic
  if (!validateMnemonic(mnemonic, wordlist)) {
    throw new Error('Invalid mnemonic phrase')
  }
  
  // Convert mnemonic to seed
  const seed = mnemonicToSeedSync(mnemonic)
  
  // Create HD wallet from seed
  const hdKey = HDKey.fromMasterSeed(seed)
  
  // Derive the specific key
  const childKey = hdKey.derive(derivationPath)
  
  if (!childKey.privateKey || !childKey.publicKey) {
    throw new Error('Failed to derive keys')
  }
  
  // Generate address
  const address = generateBitcoinAddress(childKey.publicKey, network)
  
  // Verify the derived address matches the target
  if (address !== targetAddress) {
    throw new Error('Derived address does not match target wallet address')
  }
  
  return {
    privateKey: Buffer.from(childKey.privateKey).toString('hex'),
    publicKey: Buffer.from(childKey.publicKey).toString('hex'),
    address
  }
}

// 🔬 DEMONSTRATION: Prove that seed phrases always generate the same keys
export async function demonstrateKeyRegeneration(mnemonic: string, network: 'testnet' | 'mainnet' = 'testnet') {
  console.log('🔬 DEMONSTRATION: Same seed phrase always generates identical keys\n')
  
  const results = []
  
  // Generate keys 5 times from the same mnemonic
  for (let i = 1; i <= 5; i++) {
    console.log(`🔄 Generation #${i}:`)
    
    // Derive keys (this simulates "regenerating" keys)
    const derivationPath = `m/44'/${network === 'testnet' ? "1'" : "0'"}/0'/0/0`
    const keys = await deriveKeysFromMnemonic(mnemonic, derivationPath, network)
    
    console.log(`   Address: ${keys.address}`)
    console.log(`   Private Key: ${keys.privateKey.substring(0, 16)}...`) // Show first 16 chars only
    console.log(`   Public Key: ${keys.publicKey.substring(0, 16)}...`)
    
    results.push(keys)
    
    // 🔥 "BURN" the keys (clear from memory)
    clearSensitiveData(keys)
    console.log(`   🔥 Keys burned from memory`)
    console.log('')
  }
  
  // Verify all results are identical
  const firstResult = results[0]
  const allIdentical = results.every(result => 
    result.address === firstResult.address &&
    result.privateKey === firstResult.privateKey &&
    result.publicKey === firstResult.publicKey
  )
  
  console.log(`✅ Result: All 5 generations produced ${allIdentical ? 'IDENTICAL' : 'DIFFERENT'} keys!`)
  console.log(`📝 This proves that burning keys locally doesn't affect regeneration ability.`)
  
  return {
    allIdentical,
    address: firstResult.address,
    keyGenerations: results.length
  }
} 
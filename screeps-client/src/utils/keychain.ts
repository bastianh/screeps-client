import { invoke } from '@tauri-apps/api/core'
import { isTauri } from './tauri.js'
import { createLogger } from './log.js'

const { log } = createLogger('keychain')
const SERVICE = 'screeps-desktop'

async function keychainSave(account: string, secret: string): Promise<void> {
  log(`save  [${account}]`)
  try {
    await invoke('keyring_set', { service: SERVICE, account, secret })
    log(`save  [${account}] ✓`)
  } catch (e) {
    log(`save  [${account}] ✗`, e)
    throw e
  }
}

async function keychainLoad(account: string): Promise<string | null> {
  log(`load  [${account}]`)
  try {
    const result = await invoke<string | null>('keyring_get', { service: SERVICE, account })
    log(`load  [${account}] →`, result !== null ? '[found]' : '[not found]')
    return result
  } catch (e) {
    log(`load  [${account}] ✗`, e)
    throw e
  }
}

async function keychainDelete(account: string): Promise<void> {
  log(`delete [${account}]`)
  try {
    await invoke('keyring_delete', { service: SERVICE, account })
    log(`delete [${account}] ✓`)
  } catch (e) {
    log(`delete [${account}] ✗`, e)
    throw e
  }
}

const tokenAccount = (url: string) => `${url}:token`
const serverPasswordAccount = (url: string) => `${url}:serverPassword`
const savedCredentialAccount = (url: string) => `${url}:savedCredential`

export async function saveTokenForUrl(url: string, token: string): Promise<void> {
  if (!isTauri()) return
  await keychainSave(tokenAccount(url), token)
}

export async function loadTokenForUrl(url: string): Promise<string | null> {
  if (!isTauri()) return null
  return keychainLoad(tokenAccount(url))
}

export async function deleteTokenForUrl(url: string): Promise<void> {
  if (!isTauri()) return
  await keychainDelete(tokenAccount(url))
}

export async function saveServerPasswordForUrl(url: string, password: string): Promise<void> {
  if (!isTauri()) return
  await keychainSave(serverPasswordAccount(url), password)
}

export async function loadServerPasswordForUrl(url: string): Promise<string | null> {
  if (!isTauri()) return null
  return keychainLoad(serverPasswordAccount(url))
}

export async function deleteServerPasswordForUrl(url: string): Promise<void> {
  if (!isTauri()) return
  await keychainDelete(serverPasswordAccount(url))
}

export async function saveSavedCredential(url: string, credential: string): Promise<void> {
  if (!isTauri()) return
  await keychainSave(savedCredentialAccount(url), credential)
}

export async function loadSavedCredential(url: string): Promise<string | null> {
  if (!isTauri()) return null
  return keychainLoad(savedCredentialAccount(url))
}

export async function deleteSavedCredential(url: string): Promise<void> {
  if (!isTauri()) return
  await keychainDelete(savedCredentialAccount(url))
}

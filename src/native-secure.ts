// Приложение для iPhone: шифрование отметок и вход по Face ID.
//
// Как устроено. Когда задан код, отметки хранятся только зашифрованными (AES-GCM) в системном хранилище
// приложения. Ключ данных лежит в двух местах: в Keychain под Face ID (если включён) и под кодом (PBKDF2).
// Пока приложение не открыто кодом или Face ID, расшифровать данные нечем. Во время работы данные — в памяти,
// каждое сохранение шифруется и пишется на диск.
// Модуль не импортирует state.ts: он нужен до загрузки данных.

import { Preferences } from '@capacitor/preferences'
import { AccessControl, NativeBiometric } from '@capgo/capacitor-native-biometric'
import { newDataKey, open, seal, unwrapKey, wrapKey, type Sealed, type WrappedKey } from './lib/crypto'
import { memoryStore, STORAGE_KEY, useStore } from './lib/storage'
import { setPlainMirror } from './native'

const ENC = 'ottenki:data:enc'
const WRAP = 'ottenki:key:pin'
const FACE_ON = 'ottenki:faceid'
const BIO_KEY = 'ottenki.datakey'
const PLAIN_KEYS = [STORAGE_KEY, 'ottenki:data:prev']
const MIRROR = 'ottenki:data:mirror'

let dataKey: string | null = null
let writing: Promise<unknown> = Promise.resolve()
let pendingJson: string | null = null

const getJSON = async <T>(key: string): Promise<T | null> => {
  const { value } = await Preferences.get({ key })
  if (!value) return null
  try { return JSON.parse(value) as T } catch { return null }
}

/** Данные зашифрованы (задан код в приложении). */
export async function isEncrypted(): Promise<boolean> {
  return !!(await Preferences.get({ key: ENC })).value
}

export async function biometry(): Promise<{ available: boolean; face: boolean }> {
  try {
    const r = await NativeBiometric.isAvailable()
    // BiometryType: 2 — Face ID на iOS (1 — Touch ID)
    return { available: r.isAvailable, face: r.biometryType === 2 }
  } catch {
    return { available: false, face: false }
  }
}

export async function faceIdEnabled(): Promise<boolean> {
  return (await Preferences.get({ key: FACE_ON })).value === '1'
}

/** Достать ключ по Face ID. Бросает ошибку при отмене или неудаче. */
export async function unlockWithFace(): Promise<void> {
  const { value } = await NativeBiometric.getSecureData({ key: BIO_KEY, reason: 'Открыть дневник' })
  dataKey = value
}

/** Достать ключ кодом. Возвращает false при неверном коде. */
export async function unlockWithPin(pin: string): Promise<boolean> {
  const w = await getJSON<WrappedKey>(WRAP)
  if (!w) return false
  try {
    dataKey = await unwrapKey(w, pin)
    return true
  } catch {
    return false
  }
}

/** Расшифровать данные после входа и включить хранилище в памяти. Возвращает false, если данные не открылись. */
export async function openData(): Promise<boolean> {
  const box = await getJSON<Sealed>(ENC)
  if (!box || !dataKey) return false
  try {
    const json = await open(box, dataKey)
    startStore(json)
    return true
  } catch {
    return false
  }
}

function persist(json: string) {
  pendingJson = json
  const key = dataKey
  writing = writing.then(async () => {
    if (!key || pendingJson !== json) return // уже есть более свежая версия
    const box = await seal(json, key)
    await Preferences.set({ key: ENC, value: JSON.stringify(box) })
  }).catch(() => {})
}

function startStore(json: string) {
  useStore(memoryStore({ [STORAGE_KEY]: json }, (k, v) => { if (k === STORAGE_KEY) persist(v) }))
}

/** Дождаться, пока последнее сохранение будет зашифровано и записано. */
export function flushEncrypted(): Promise<unknown> {
  return writing
}

function removePlain() {
  for (const k of PLAIN_KEYS) { try { localStorage.removeItem(k) } catch { /* */ } }
  Preferences.remove({ key: MIRROR }).catch(() => {})
}

/** Включить шифрование: новый ключ, его копия под кодом, открытые копии данных удаляются. */
export async function enableEncryption(pin: string, json: string): Promise<void> {
  dataKey = newDataKey()
  await Preferences.set({ key: WRAP, value: JSON.stringify(await wrapKey(dataKey, pin)) })
  await Preferences.set({ key: ENC, value: JSON.stringify(await seal(json, dataKey)) })
  startStore(json)
  setPlainMirror(false)
  removePlain()
}

/** Сменить код: ключ данных тот же, меняется только его копия под кодом. */
export async function rewrapKey(pin: string): Promise<void> {
  if (!dataKey) throw new Error('Дневник не открыт')
  await Preferences.set({ key: WRAP, value: JSON.stringify(await wrapKey(dataKey, pin)) })
}

/** Выключить шифрование: данные снова хранятся открыто, ключи удаляются. */
export async function disableEncryption(json: string): Promise<void> {
  await writing
  localStorage.setItem(STORAGE_KEY, json)
  useStore(null)
  setPlainMirror(true)
  await Preferences.set({ key: MIRROR, value: json })
  await Promise.all([Preferences.remove({ key: ENC }), Preferences.remove({ key: WRAP }), Preferences.remove({ key: FACE_ON })])
  await NativeBiometric.deleteData({ key: BIO_KEY }).catch(() => {})
  dataKey = null
}

/** Включить вход по Face ID: сначала подтвердить лицом, затем положить ключ в Keychain под Face ID. */
export async function enableFace(): Promise<void> {
  if (!dataKey) throw new Error('Дневник не открыт')
  await NativeBiometric.verifyIdentity({ reason: 'Включить вход по Face ID', title: 'Оттенки' })
  await NativeBiometric.setData({ key: BIO_KEY, value: dataKey, accessControl: AccessControl.BIOMETRY_ANY })
  await Preferences.set({ key: FACE_ON, value: '1' })
}

export async function disableFace(): Promise<void> {
  await NativeBiometric.deleteData({ key: BIO_KEY }).catch(() => {})
  await Preferences.remove({ key: FACE_ON })
}

/** Подтвердить лицом (повторная блокировка во время работы, ключ уже в памяти). */
export async function verifyFace(): Promise<void> {
  await NativeBiometric.verifyIdentity({ reason: 'Открыть дневник', title: 'Оттенки' })
}

/** Последний выход: стереть зашифрованные данные и ключи (код забыт, Face ID не помогает). */
export async function wipeEncrypted(): Promise<void> {
  await Promise.all([Preferences.remove({ key: ENC }), Preferences.remove({ key: WRAP }), Preferences.remove({ key: FACE_ON })])
  await NativeBiometric.deleteData({ key: BIO_KEY }).catch(() => {})
  try {
    localStorage.removeItem('ottenki:lock:v1')
    localStorage.removeItem('ottenki:lock:reset-at')
  } catch { /* */ }
  dataKey = null
}

import { describe, expect, it } from 'vitest'
import { newDataKey, open, seal, unwrapKey, wrapKey } from '../src/lib/crypto'
import { load, memoryStore, save, STORAGE_KEY, useStore } from '../src/lib/storage'
import { defaultData } from '../src/lib/model'

describe('шифрование', () => {
  it('зашифрованное расшифровывается тем же ключом и не читается другим', async () => {
    const key = newDataKey()
    const box = await seal('Сдал коллоквиум по матану', key)
    expect(box.ct).not.toContain('матан')
    expect(await open(box, key)).toBe('Сдал коллоквиум по матану')
    await expect(open(box, newDataKey())).rejects.toBeTruthy()
  })

  it('каждое шифрование — со своим вектором', async () => {
    const key = newDataKey()
    const a = await seal('одно и то же', key), b = await seal('одно и то же', key)
    expect(a.iv).not.toBe(b.iv)
    expect(a.ct).not.toBe(b.ct)
  })

  it('ключ под кодом достаётся только верным кодом', async () => {
    const key = newDataKey()
    const w = await wrapKey(key, '1234', 1000)
    expect(await unwrapKey(w, '1234')).toBe(key)
    await expect(unwrapKey(w, '4321')).rejects.toBeTruthy()
  })
})

describe('хранилище в памяти', () => {
  it('сохранение уходит в обработчик, загрузка читает из памяти', () => {
    const writes: string[] = []
    const d = defaultData()
    d.entries['2026-11-04'] = { level: d.levels[5].id, at: 1, note: 'в памяти' }
    const store = memoryStore({ [STORAGE_KEY]: JSON.stringify(d) }, (k, v) => { if (k === STORAGE_KEY) writes.push(v) })
    useStore(store)
    try {
      const r = load()
      expect(r.data.entries['2026-11-04'].note).toBe('в памяти')
      r.data.entries['2026-11-05'] = { level: d.levels[1].id, at: 2 }
      expect(save(r.data)).toBe(true)
      expect(writes).toHaveLength(1)
      expect(JSON.parse(writes[0]).entries['2026-11-05']).toBeTruthy()
    } finally {
      useStore(null)
    }
  })

  it('старые данные без напоминания получают его выключенным', () => {
    const d = defaultData() as any
    delete d.settings.reminder
    const store = memoryStore({ [STORAGE_KEY]: JSON.stringify(d) }, () => {})
    useStore(store)
    try {
      expect(load().data.settings.reminder).toEqual({ on: false, time: '21:30' })
    } finally {
      useStore(null)
    }
  })
})

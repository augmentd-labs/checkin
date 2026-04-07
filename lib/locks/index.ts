export interface LockProvider {
  provisionCode(params: {
    deviceId: string
    pin: string
    name: string
    allowedFromDate: string // ISO datetime string
    allowedUntilDate: string // ISO datetime string
  }): Promise<void>
  revokeCode(params: { deviceId: string; pin: string }): Promise<void>
}

export class LockProviderNotImplementedError extends Error {
  constructor(provider: string) {
    super(`Lock provider '${provider}' is not yet implemented`)
    this.name = 'LockProviderNotImplementedError'
  }
}

export function getLockProvider(lockProvider: string): LockProvider {
  switch (lockProvider) {
    case 'nuki':
      return new NukiLockProvider()
    case 'lockin':
      return new LockinLockProvider()
    case 'loki':
      return new LokiLockProvider()
    default:
      throw new Error(`Unknown lock provider: ${lockProvider}`)
  }
}

// ─── Nuki ─────────────────────────────────────────────────────────────────────

class NukiLockProvider implements LockProvider {
  async provisionCode({ deviceId, pin, name, allowedFromDate, allowedUntilDate }: {
    deviceId: string
    pin: string
    name: string
    allowedFromDate: string
    allowedUntilDate: string
  }): Promise<void> {
    const response = await fetch(`https://api.nuki.io/smartlock/${deviceId}/auth`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.NUKI_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        code: parseInt(pin, 10),
        type: 13, // keypad code
        allowedFromDate,
        allowedUntilDate,
      }),
    })
    if (!response.ok) {
      throw new Error(`Nuki API error: ${response.status}`)
    }
  }

  async revokeCode({ deviceId, pin }: { deviceId: string; pin: string }): Promise<void> {
    // Nuki requires fetching the auth ID first, then deleting it
    const listResponse = await fetch(`https://api.nuki.io/smartlock/${deviceId}/auth`, {
      headers: { Authorization: `Bearer ${process.env.NUKI_API_TOKEN}` },
    })
    if (!listResponse.ok) throw new Error(`Nuki API error: ${listResponse.status}`)
    const auths = await listResponse.json() as Array<{ id: number; code: number }>
    const match = auths.find((a) => a.code === parseInt(pin, 10))
    if (!match) return

    const deleteResponse = await fetch(
      `https://api.nuki.io/smartlock/${deviceId}/auth/${match.id}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${process.env.NUKI_API_TOKEN}` },
      }
    )
    if (!deleteResponse.ok) throw new Error(`Nuki revoke error: ${deleteResponse.status}`)
  }
}

// ─── Lockin ───────────────────────────────────────────────────────────────────

class LockinLockProvider implements LockProvider {
  async provisionCode(_params: {
    deviceId: string
    pin: string
    name: string
    allowedFromDate: string
    allowedUntilDate: string
  }): Promise<void> {
    throw new LockProviderNotImplementedError('lockin')
  }

  async revokeCode(_params: { deviceId: string; pin: string }): Promise<void> {
    throw new LockProviderNotImplementedError('lockin')
  }
}

// ─── Loki ─────────────────────────────────────────────────────────────────────

class LokiLockProvider implements LockProvider {
  async provisionCode(_params: {
    deviceId: string
    pin: string
    name: string
    allowedFromDate: string
    allowedUntilDate: string
  }): Promise<void> {
    throw new LockProviderNotImplementedError('loki')
  }

  async revokeCode(_params: { deviceId: string; pin: string }): Promise<void> {
    throw new LockProviderNotImplementedError('loki')
  }
}
